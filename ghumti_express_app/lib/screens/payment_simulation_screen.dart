import 'dart:convert';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import 'home_screen.dart';

class PaymentSimulationScreen extends StatefulWidget {
  final String orderId;
  final String gateway;
  final double totalAmount;
  final Map<String, dynamic> paymentPayload;

  const PaymentSimulationScreen({
    super.key,
    required this.orderId,
    required this.gateway,
    required this.totalAmount,
    required this.paymentPayload,
  });

  @override
  State<PaymentSimulationScreen> createState() => _PaymentSimulationScreenState();
}

class _ProductDetailsRow extends StatelessWidget {
  final String label;
  final String value;

  const _ProductDetailsRow({required this.label, required this.value});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(color: Colors.grey)),
          Text(value, style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }
}

class _PaymentSimulationScreenState extends State<PaymentSimulationScreen> {
  bool _tamperEsewa = false;
  bool _isUploadingVoucher = false;
  bool _isVerifying = false;
  String _khaltiStatus = 'Completed'; // or 'User Canceled'

  Future<void> _completeEsewaPayment() async {
    setState(() => _isVerifying = true);
    try {
      final payload = widget.paymentPayload['payload'];
      final String signature = payload['signature'];
      final String transactionUuid = payload['transaction_uuid'];
      final String productCode = payload['product_code'];

      // If user checks the tampering simulation box, we modify the amount to 1.00
      final double totalAmountToSend = _tamperEsewa ? 1.00 : widget.totalAmount;

      // Construct eSewa callback payload
      final callbackData = {
        'status': 'COMPLETE',
        'total_amount': totalAmountToSend.toStringAsFixed(2),
        'transaction_uuid': transactionUuid,
        'product_code': productCode,
        'signature': signature, // Same signature, which was computed with the original amount
      };

      final jsonString = jsonEncode(callbackData);
      final encodedPayload = base64Encode(utf8.encode(jsonString));

      // Call callback endpoint
      final success = await ApiService.verifyEsewa(encodedPayload);
      _showResultDialog(success);
    } catch (e) {
      _showResultDialog(false, message: e.toString());
    } finally {
      setState(() => _isVerifying = false);
    }
  }

  Future<void> _completeKhaltiPayment() async {
    setState(() => _isVerifying = true);
    try {
      final payload = widget.paymentPayload['payload'];
      final String pidx = payload['pidx'];
      final String purchaseOrderId = payload['purchase_order_id'];
      final String purchaseOrderName = payload['purchase_order_name'];
      final int amount = payload['amount'];

      final success = await ApiService.verifyKhalti(
        pidx,
        'TXN-KHL-${DateTime.now().millisecondsSinceEpoch}',
        amount.toDouble() / 100.0,
        purchaseOrderId,
        purchaseOrderName,
      );

      // If user selected User Canceled, send canceled status to backend
      if (_khaltiStatus == 'User Canceled') {
        final cancelUrl = '${ApiService.baseUrl}/api/payment/callback/khalti?pidx=$pidx&status=User%20Canceled';
        final response = await httpGetSimulated(cancelUrl);
        _showResultDialog(false, message: 'Payment cancelled by user.');
      } else {
        _showResultDialog(success);
      }
    } catch (e) {
      _showResultDialog(false, message: e.toString());
    } finally {
      setState(() => _isVerifying = false);
    }
  }

  // Simulated HTTP GET helper since we don't import direct http client here
  Future<String> httpGetSimulated(String url) async {
    final client = HttpClient();
    final request = await client.getUrl(Uri.parse(url));
    final response = await request.close();
    return response.statusCode == 200 ? 'success' : 'failed';
  }

  Future<void> _completeConnectIPS() async {
    setState(() => _isVerifying = true);
    try {
      final payload = widget.paymentPayload['payload'];
      final String txnId = payload['txnId'];

      final client = HttpClient();
      final uri = Uri.parse('${ApiService.baseUrl}/api/payment/callback/connectips?txnId=$txnId');
      final request = await client.getUrl(uri);
      final response = await request.close();

      _showResultDialog(response.statusCode == 200);
    } catch (e) {
      _showResultDialog(false, message: e.toString());
    } finally {
      setState(() => _isVerifying = false);
    }
  }

  Future<void> _completeFonepay() async {
    setState(() => _isVerifying = true);
    try {
      final payload = widget.paymentPayload['payload'];
      final String txnUuid = payload['transaction_uuid'];

      final client = HttpClient();
      final uri = Uri.parse('${ApiService.baseUrl}/api/payment/callback/fonepay?txnId=$txnUuid');
      final request = await client.getUrl(uri);
      final response = await request.close();

      _showResultDialog(response.statusCode == 200);
    } catch (e) {
      _showResultDialog(false, message: e.toString());
    } finally {
      setState(() => _isVerifying = false);
    }
  }

  Future<void> _uploadMockVoucher() async {
    setState(() => _isUploadingVoucher = true);
    try {
      // Create a mock text/image file in system temp directory
      final tempDir = Directory.systemTemp;
      final file = File('${tempDir.path}/mock_bank_voucher.png');
      await file.writeAsString('This is a simulated bank deposit voucher slip.');

      final success = await ApiService.uploadBankVoucher(widget.orderId, file);
      if (success) {
        if (mounted) {
          showDialog(
            context: context,
            barrierDismissible: false,
            builder: (ctx) => AlertDialog(
              backgroundColor: const Color(0xFF1E1E1E),
              title: const Text('Voucher Uploaded', style: TextStyle(color: Colors.greenAccent)),
              content: const Text(
                'Your bank voucher has been uploaded successfully. Please wait for Admin approval to activate your ticket split.',
                style: TextStyle(color: Colors.white),
              ),
              actions: [
                TextButton(
                  onPressed: () {
                    Navigator.of(ctx).pop();
                    Provider.of<AppState>(context, listen: false).clearCart();
                    Navigator.of(context).pushReplacement(
                      MaterialPageRoute(builder: (_) => const HomeScreen()),
                    );
                  },
                  child: const Text('Return to Shop', style: TextStyle(color: Colors.amber)),
                ),
              ],
            ),
          );
        }
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Voucher upload failed.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    } finally {
      setState(() => _isUploadingVoucher = false);
    }
  }

  void _showResultDialog(bool success, {String? message}) {
    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E1E),
        title: Text(
          success ? 'Payment Success' : 'Payment Failed',
          style: TextStyle(color: success ? Colors.greenAccent : Colors.redAccent, fontWeight: FontWeight.bold),
        ),
        content: Text(
          message ??
              (success
                  ? 'Your payment was validated successfully. The order has been sent to the picking split.'
                  : 'Payment verification failed. Check the Security Audit Console on the backend for warnings.'),
          style: const TextStyle(color: Colors.white),
        ),
        actions: [
          TextButton(
            onPressed: () {
              Navigator.of(ctx).pop();
              if (success) {
                Provider.of<AppState>(context, listen: false).clearCart();
              }
              Navigator.of(context).pushReplacement(
                MaterialPageRoute(builder: (_) => const HomeScreen()),
              );
            },
            child: const Text('Go Home', style: TextStyle(color: Colors.amber)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final gatewayName = widget.gateway.toUpperCase();

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        foregroundColor: Colors.white,
        title: Text('$gatewayName Payment Portal'),
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(20.0),
          child: Card(
            color: const Color(0xFF1E1E1E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Simulating $gatewayName Checkout',
                    textAlign: TextAlign.center,
                    style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  const Divider(color: Colors.grey),
                  const SizedBox(height: 12),
                  _ProductDetailsRow(label: 'Order ID', value: widget.orderId),
                  _ProductDetailsRow(label: 'Merchant', value: 'Ghumti Express Quick-Commerce'),
                  _ProductDetailsRow(label: 'Total Amount', value: 'NPR ${widget.totalAmount.toStringAsFixed(2)}'),
                  const SizedBox(height: 16),
                  const Divider(color: Colors.grey),
                  const SizedBox(height: 24),
                  
                  // Specific gateway simulators
                  if (widget.gateway == 'esewa') ...[
                    // eSewa Tampering simulation check
                    CheckboxListTile(
                      title: const Text(
                        'Simulate Price Tampering (Scenario B)',
                        style: TextStyle(color: Colors.white, fontSize: 13),
                      ),
                      subtitle: const Text(
                        'Modifies callback amount to NPR 1.00 (causes HMAC Signature Mismatch)',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                      value: _tamperEsewa,
                      activeColor: Colors.amber,
                      onChanged: (val) {
                        if (val != null) setState(() => _tamperEsewa = val);
                      },
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _isVerifying ? null : _completeEsewaPayment,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isVerifying
                          ? const CircularProgressIndicator(color: Colors.black)
                          : const Text('AUTHENTICATE & COMPLETE PAYMENT', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ] else if (widget.gateway == 'khalti') ...[
                    // Khalti status simulation selector
                    const Text('Simulate Transaction Status', style: TextStyle(color: Colors.grey, fontSize: 12)),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      dropdownColor: const Color(0xFF1E1E1E),
                      style: const TextStyle(color: Colors.white),
                      value: _khaltiStatus,
                      decoration: InputDecoration(
                        enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Colors.grey[700]!)),
                        focusedBorder: const OutlineInputBorder(borderSide: BorderSide(color: Colors.amber)),
                      ),
                      items: ['Completed', 'User Canceled'].map((status) {
                        return DropdownMenuItem(value: status, child: Text(status));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) setState(() => _khaltiStatus = val);
                      },
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _isVerifying ? null : _completeKhaltiPayment,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isVerifying
                          ? const CircularProgressIndicator(color: Colors.black)
                          : const Text('SUBMIT TRANSACTION RESPONSE', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ] else if (widget.gateway == 'connectips') ...[
                    ElevatedButton(
                      onPressed: _isVerifying ? null : _completeConnectIPS,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isVerifying
                          ? const CircularProgressIndicator(color: Colors.black)
                          : const Text('CONFIRM IPS TRANSFER', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ] else if (widget.gateway == 'fonepay') ...[
                    // Show QR Code Placeholder
                    const Icon(Icons.qr_code_2, size: 140, color: Colors.white),
                    const SizedBox(height: 12),
                    const Text('Scan with Fonepay App', textAlign: TextAlign.center, style: TextStyle(color: Colors.grey, fontSize: 12)),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _isVerifying ? null : _completeFonepay,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isVerifying
                          ? const CircularProgressIndicator(color: Colors.black)
                          : const Text('COMPLETE SCANNED PAYMENT', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ] else if (widget.gateway == 'bank_voucher') ...[
                    const Icon(Icons.receipt_long, size: 80, color: Colors.amber),
                    const SizedBox(height: 16),
                    const Text(
                      'Simulate upload of deposit voucher slip',
                      textAlign: TextAlign.center,
                      style: TextStyle(color: Colors.grey, fontSize: 13),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: _isUploadingVoucher ? null : _uploadMockVoucher,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: _isUploadingVoucher
                          ? const CircularProgressIndicator(color: Colors.black)
                          : const Text('UPLOAD SIMULATED SLIP', style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

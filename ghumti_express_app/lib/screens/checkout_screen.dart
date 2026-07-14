import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import 'payment_simulation_screen.dart';

class CheckoutScreen extends StatefulWidget {
  const CheckoutScreen({super.key});

  @override
  State<CheckoutScreen> createState() => _CheckoutScreenState();
}

class _CheckoutScreenState extends State<CheckoutScreen> {
  String _selectedGateway = 'esewa';
  bool _isLoading = false;
  String _errorMessage = '';

  final List<Map<String, String>> _gateways = [
    {'id': 'esewa', 'name': 'eSewa', 'desc': 'Pay via eSewa Portal (Anti-Tamper Demo)'},
    {'id': 'khalti', 'name': 'Khalti V2', 'desc': 'Pay via Khalti Portal (Lookup Verification)'},
    {'id': 'connectips', 'name': 'ConnectIPS', 'desc': 'Direct Bank Transfer'},
    {'id': 'fonepay', 'name': 'FonePay QR', 'desc': 'Scan and Pay'},
    {'id': 'bank_voucher', 'name': 'Bank Voucher Upload', 'desc': 'Upload bank deposit voucher slip'},
  ];

  Future<void> _handleCheckout() async {
    final appState = Provider.of<AppState>(context, listen: false);
    final cartItems = appState.cartItems;
    final user = appState.currentUser;

    if (cartItems.isEmpty || user == null) return;

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      // 1. Convert cart items to the API format [{ id: productId, qty: qty }]
      final itemsPayload = cartItems.map((item) => {
        'id': item.product.id,
        'qty': item.quantity,
      }).toList();

      // 2. Call backend checkout
      final checkoutRes = await ApiService.checkout(user.username, itemsPayload);
      if (checkoutRes['success'] == true) {
        final orderData = checkoutRes['order'];
        final orderId = orderData['id'];

        // 3. Initiate payment
        final initiateRes = await ApiService.initiatePayment(orderId, _selectedGateway);
        if (initiateRes['success'] == true) {
          if (mounted) {
            // Navigate to Payment Simulation Screen
            Navigator.of(context).pushReplacement(
              MaterialPageRoute(
                builder: (_) => PaymentSimulationScreen(
                  orderId: orderId,
                  gateway: _selectedGateway,
                  totalAmount: appState.totalAmount,
                  paymentPayload: initiateRes,
                ),
              ),
            );
          }
        }
      }
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        foregroundColor: Colors.white,
        title: const Text('Checkout Details'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.amber))
          : Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Text(
                    'Select Payment Method',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 16),
                  if (_errorMessage.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.redAccent),
                      ),
                      child: Text(_errorMessage, style: const TextStyle(color: Colors.redAccent)),
                    ),
                    const SizedBox(height: 16),
                  ],
                  Expanded(
                    child: ListView.builder(
                      itemCount: _gateways.length,
                      itemBuilder: (context, index) {
                        final gw = _gateways[index];
                        final isSelected = _selectedGateway == gw['id'];
                        return Card(
                          color: isSelected ? const Color(0xFF2E2413) : const Color(0xFF1E1E1E),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: isSelected ? Colors.amber : Colors.transparent,
                              width: 1.5,
                            ),
                          ),
                          child: RadioListTile<String>(
                            value: gw['id']!,
                            groupValue: _selectedGateway,
                            activeColor: Colors.amber,
                            title: Text(
                              gw['name']!,
                              style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                            ),
                            subtitle: Text(
                              gw['desc']!,
                              style: TextStyle(color: Colors.grey[400], fontSize: 12),
                            ),
                            onChanged: (val) {
                              if (val != null) {
                                setState(() => _selectedGateway = val);
                              }
                            },
                          ),
                        );
                      },
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E1E1E),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Amount Payable', style: TextStyle(color: Colors.grey, fontSize: 15)),
                        Text(
                          'NPR ${appState.totalAmount.toStringAsFixed(2)}',
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.amber),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  ElevatedButton(
                    onPressed: _handleCheckout,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                    ),
                    child: const Text('CONFIRM AND INITIATE PAYMENT', style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),
            ),
    );
  }
}

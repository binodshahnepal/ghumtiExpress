import 'package:flutter/material.dart';
import '../models/order.dart';
import '../models/product.dart';
import '../services/api_service.dart';

class RiderHandoffScreen extends StatefulWidget {
  const RiderHandoffScreen({super.key});

  @override
  State<RiderHandoffScreen> createState() => _RiderHandoffScreenState();
}

class _RiderHandoffScreenState extends State<RiderHandoffScreen> {
  List<Order> _orders = [];
  Map<int, Product> _productMap = {};
  bool _isLoading = true;
  String _errorMessage = '';

  // Controllers for Driver Lock Age Verification
  final Map<String, TextEditingController> _idControllers = {};
  final Map<String, String> _selectedIdTypes = {};
  final Map<String, bool> _ageConfirmations = {};

  @override
  void initState() {
    super.initState();
    _loadOrders();
  }

  @override
  void dispose() {
    for (var controller in _idControllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> _loadOrders() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    try {
      final products = await ApiService.fetchProducts();
      final productMap = {for (var p in products) p.id: p};
      final orders = await ApiService.fetchOrders();
      setState(() {
        _productMap = productMap;
        _orders = orders;
      });
    } catch (e) {
      setState(() => _errorMessage = 'Failed to load delivery queue: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  bool _isReadyForDelivery(Order order) {
    // Order must be in processing/paid status and not already completed or cancelled
    if (order.status != 'paid_processing' && order.status != 'processing') return false;

    // Check if order contains groceries/liquor
    final hasWarehouseItems = order.items.any((item) {
      final prod = _productMap[item.productId];
      return prod != null && (prod.categoryId == 1 || prod.categoryId == 2);
    });

    // Check if order contains coffee
    final hasCoffeeItems = order.items.any((item) {
      final prod = _productMap[item.productId];
      return prod != null && prod.categoryId == 3;
    });

    bool warehouseReady = !hasWarehouseItems || order.splitStatusWarehouse == 'completed';
    bool baristaReady = !hasCoffeeItems || order.splitStatusBarista == 'completed';

    return warehouseReady && baristaReady;
  }

  bool _containsAgeRestricted(Order order) {
    return order.items.any((item) {
      final prod = _productMap[item.productId];
      return prod != null && prod.isAgeRestricted;
    });
  }

  Future<void> _completeDelivery(String orderId, bool needsAgeCheck) async {
    String idType = '';
    String idNumber = '';

    if (needsAgeCheck) {
      idType = _selectedIdTypes[orderId] ?? 'Driver License';
      idNumber = (_idControllers[orderId]?.text ?? '').trim();
      final confirmed = _ageConfirmations[orderId] ?? false;

      if (idNumber.isEmpty || !confirmed) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('ID number and verification confirmation are required.')),
        );
        return;
      }
    }

    try {
      final success = await ApiService.completeOrder(orderId, idType, idNumber);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order $orderId successfully delivered!')),
        );
        _loadOrders();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to complete delivery.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  Widget _buildDeliveryCard(Order order) {
    final needsAgeCheck = _containsAgeRestricted(order);
    
    // Initialize state controllers for this order if not already done
    if (!_selectedIdTypes.containsKey(order.id)) {
      _selectedIdTypes[order.id] = 'Driver License';
      _idControllers[order.id] = TextEditingController();
      _ageConfirmations[order.id] = false;
    }

    return Card(
      color: const Color(0xFF1E1E1E),
      margin: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Order ID: ${order.id}',
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                ),
                Text(
                  'NPR ${order.totalAmount.toStringAsFixed(2)}',
                  style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold),
                ),
              ],
            ),
            const SizedBox(height: 6),
            Text('Customer: ${order.username}', style: TextStyle(color: Colors.grey[300], fontSize: 13)),
            const SizedBox(height: 12),
            const Text('Delivery items:', style: TextStyle(color: Colors.grey, fontWeight: FontWeight.bold, fontSize: 12)),
            const SizedBox(height: 6),
            ...order.items.map((item) {
              final prod = _productMap[item.productId];
              final isRestricted = prod != null && prod.isAgeRestricted;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 2.0),
                child: Row(
                  children: [
                    Text('${item.qty}x ', style: const TextStyle(color: Colors.amber)),
                    Expanded(child: Text(item.name, style: const TextStyle(color: Colors.white, fontSize: 13))),
                    if (isRestricted)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                        decoration: BoxDecoration(color: Colors.redAccent, borderRadius: BorderRadius.circular(3)),
                        child: const Text('18+', style: TextStyle(color: Colors.white, fontSize: 8, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
              );
            }),
            
            // Age Verification Lock Block (Scenario D)
            if (needsAgeCheck) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Colors.redAccent.withOpacity(0.1),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Row(
                      children: [
                        Icon(Icons.lock, color: Colors.redAccent, size: 18),
                        SizedBox(width: 8),
                        Text(
                          'DRIVER LOCK: AGE VERIFICATION REQUIRED',
                          style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, fontSize: 11),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    const Text('Select Photo ID Type:', style: TextStyle(color: Colors.white, fontSize: 12)),
                    DropdownButton<String>(
                      dropdownColor: const Color(0xFF1E1E1E),
                      value: _selectedIdTypes[order.id],
                      style: const TextStyle(color: Colors.white),
                      isExpanded: true,
                      items: ['Driver License', 'Citizenship Card', 'Passport'].map((idType) {
                        return DropdownMenuItem(value: idType, child: Text(idType));
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _selectedIdTypes[order.id] = val);
                        }
                      },
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      controller: _idControllers[order.id],
                      style: const TextStyle(color: Colors.white, fontSize: 13),
                      decoration: const InputDecoration(
                        labelText: 'Document / ID Number',
                        labelStyle: TextStyle(color: Colors.grey, fontSize: 12),
                        focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.amber)),
                      ),
                    ),
                    const SizedBox(height: 8),
                    CheckboxListTile(
                      contentPadding: EdgeInsets.zero,
                      title: const Text(
                        'I verify the customer is over 18 and the document details are correct.',
                        style: TextStyle(color: Colors.grey, fontSize: 11),
                      ),
                      value: _ageConfirmations[order.id],
                      activeColor: Colors.amber,
                      onChanged: (val) {
                        if (val != null) {
                          setState(() => _ageConfirmations[order.id] = val);
                        }
                      },
                    ),
                  ],
                ),
              ),
            ],
            
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _completeDelivery(order.id, needsAgeCheck),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('MARK DELIVERED', style: TextStyle(fontWeight: FontWeight.bold)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final readyOrders = _orders.where(_isReadyForDelivery).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        foregroundColor: Colors.white,
        title: const Text('Rider Delivery Handoff'),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            onPressed: _loadOrders,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.amber))
          : _errorMessage.isNotEmpty
              ? Center(child: Text(_errorMessage, style: const TextStyle(color: Colors.redAccent)))
              : readyOrders.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.check_circle_outline, size: 64, color: Colors.greenAccent.withOpacity(0.5)),
                          const SizedBox(height: 16),
                          const Text('No orders ready for delivery yet.', style: TextStyle(color: Colors.grey)),
                          const SizedBox(height: 4),
                          const Text('Fulfillment splits must be completed first.', style: TextStyle(color: Colors.grey, fontSize: 11)),
                        ],
                      ),
                    )
                  : ListView.builder(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      itemCount: readyOrders.length,
                      itemBuilder: (context, index) {
                        return _buildDeliveryCard(readyOrders[index]);
                      },
                    ),
    );
  }
}

import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../models/order.dart';
import '../models/product.dart';
import '../services/api_service.dart';

class OperatorSplitScreen extends StatefulWidget {
  const OperatorSplitScreen({super.key});

  @override
  State<OperatorSplitScreen> createState() => _OperatorSplitScreenState();
}

class _OperatorSplitScreenState extends State<OperatorSplitScreen> {
  List<Order> _orders = [];
  Map<int, Product> _productMap = {};
  bool _isLoading = true;
  String _errorMessage = '';

  @override
  void initState() {
    super.initState();
    _loadQueues();
  }

  Future<void> _loadQueues() async {
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
      setState(() => _errorMessage = 'Failed to load queues: $e');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _dispatch(String orderId, String role) async {
    try {
      final success = await ApiService.dispatchOrder(orderId, role);
      if (success) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Order $orderId dispatched by $role!')),
        );
        _loadQueues();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to update status.')),
        );
      }
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $e')),
      );
    }
  }

  List<Order> _getWarehouseOrders() {
    return _orders.where((o) {
      // Must be paid/processing and warehouse split status is pending
      final isPaid = o.status == 'paid_processing' || o.status == 'processing';
      final isWarehousePending = o.splitStatusWarehouse == 'pending';
      if (!isPaid || !isWarehousePending) return false;

      // Must contain warehouse items (category 1: liquor, category 2: grocery)
      return o.items.any((item) {
        final prod = _productMap[item.productId];
        return prod != null && (prod.categoryId == 1 || prod.categoryId == 2);
      });
    }).toList();
  }

  List<Order> _getBaristaOrders() {
    return _orders.where((o) {
      // Must be paid/processing and barista split status is pending
      final isPaid = o.status == 'paid_processing' || o.status == 'processing';
      final isBaristaPending = o.splitStatusBarista == 'pending';
      if (!isPaid || !isBaristaPending) return false;

      // Must contain coffee items (category 3)
      return o.items.any((item) {
        final prod = _productMap[item.productId];
        return prod != null && prod.categoryId == 3;
      });
    }).toList();
  }

  Widget _buildOrderCard(Order order, String role, List<OrderItem> filteredItems) {
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
                  style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white, fontSize: 14),
                ),
                Text(
                  order.date.length > 10 ? order.date.substring(0, 10) : order.date,
                  style: const TextStyle(color: Colors.grey, fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Text('Items to prepare:', style: TextStyle(color: Colors.amber, fontWeight: FontWeight.bold, fontSize: 13)),
            const SizedBox(height: 6),
            ...filteredItems.map((item) {
              final prod = _productMap[item.productId];
              final ageWarning = prod != null && prod.isAgeRestricted;
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 4.0),
                child: Row(
                  children: [
                    Text('${item.qty}x ', style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold)),
                    Expanded(child: Text(item.name, style: const TextStyle(color: Colors.white))),
                    if (ageWarning)
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(color: Colors.redAccent, borderRadius: BorderRadius.circular(4)),
                        child: const Text('18+', style: TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold)),
                      ),
                  ],
                ),
              );
            }),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: () => _dispatch(order.id, role),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.amber,
                  foregroundColor: Colors.black,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: Text(role == 'warehouse' ? 'MARK PACKED & DISPATCHED' : 'MARK BREWED & READY'),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: 2,
      child: Scaffold(
        backgroundColor: const Color(0xFF121212),
        appBar: AppBar(
          backgroundColor: const Color(0xFF1A1A1A),
          foregroundColor: Colors.white,
          title: const Text('Operator Splitting Queues'),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh),
              onPressed: _loadQueues,
            ),
          ],
          bottom: const TabBar(
            indicatorColor: Colors.amber,
            labelColor: Colors.amber,
            unselectedLabelColor: Colors.grey,
            tabs: [
              Tab(icon: Icon(Icons.warehouse), text: 'Warehouse (Grocery/Liquor)'),
              Tab(icon: Icon(Icons.coffee), text: 'Barista Station (Coffee)'),
            ],
          ),
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator(color: Colors.amber))
            : _errorMessage.isNotEmpty
                ? Center(
                    child: Text(_errorMessage, style: const TextStyle(color: Colors.redAccent)),
                  )
                : TabBarView(
                    children: [
                      // Warehouse Queue
                      _getWarehouseOrders().isEmpty
                          ? Center(child: Text('No pending warehouse packages.', style: TextStyle(color: Colors.grey[500])))
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              itemCount: _getWarehouseOrders().length,
                              itemBuilder: (context, index) {
                                final order = _getWarehouseOrders()[index];
                                final filtered = order.items.where((item) {
                                  final prod = _productMap[item.productId];
                                  return prod != null && (prod.categoryId == 1 || prod.categoryId == 2);
                                }).toList();
                                return _buildOrderCard(order, 'warehouse', filtered);
                              },
                            ),
                      // Barista Station
                      _getBaristaOrders().isEmpty
                          ? Center(child: Text('No pending coffee orders.', style: TextStyle(color: Colors.grey[500])))
                          : ListView.builder(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              itemCount: _getBaristaOrders().length,
                              itemBuilder: (context, index) {
                                final order = _getBaristaOrders()[index];
                                final filtered = order.items.where((item) {
                                  final prod = _productMap[item.productId];
                                  return prod != null && prod.categoryId == 3;
                                }).toList();
                                return _buildOrderCard(order, 'barista', filtered);
                              },
                            ),
                    ],
                  ),
      ),
    );
  }
}

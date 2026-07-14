class OrderItem {
  final int id;
  final String orderId;
  final int productId;
  final String name;
  final double price;
  final int qty;

  OrderItem({
    required this.id,
    required this.orderId,
    required this.productId,
    required this.name,
    required this.price,
    required this.qty,
  });

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      id: json['id'] ?? 0,
      orderId: json['orderId'] ?? '',
      productId: json['productId'] ?? 0,
      name: json['name'] ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      qty: json['qty'] ?? 0,
    );
  }
}

class Order {
  final String id;
  final double subtotal;
  final double tax;
  final double deliveryFee;
  final double totalAmount;
  final String username;
  final String status;
  final String splitStatusWarehouse;
  final String splitStatusBarista;
  final bool driverConfirmedAge;
  final String date;
  final String? gateway;
  final String? voucherImageUrl;
  final List<OrderItem> items;

  Order({
    required this.id,
    required this.subtotal,
    required this.tax,
    required this.deliveryFee,
    required this.totalAmount,
    required this.username,
    required this.status,
    required this.splitStatusWarehouse,
    required this.splitStatusBarista,
    required this.driverConfirmedAge,
    required this.date,
    this.gateway,
    this.voucherImageUrl,
    required this.items,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    var itemsList = json['items'] as List? ?? [];
    List<OrderItem> parsedItems = itemsList.map((i) => OrderItem.fromJson(i)).toList();

    return Order(
      id: json['id'] ?? '',
      subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
      tax: (json['tax'] as num?)?.toDouble() ?? 0.0,
      deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0.0,
      totalAmount: (json['totalAmount'] as num?)?.toDouble() ?? 0.0,
      username: json['username'] ?? '',
      status: json['status'] ?? '',
      splitStatusWarehouse: json['splitStatusWarehouse'] ?? '',
      splitStatusBarista: json['splitStatusBarista'] ?? '',
      driverConfirmedAge: (json['driverConfirmedAge'] == 1 || json['driverConfirmedAge'] == true),
      date: json['date'] ?? '',
      gateway: json['gateway'],
      voucherImageUrl: json['voucherImageUrl'],
      items: parsedItems,
    );
  }
}

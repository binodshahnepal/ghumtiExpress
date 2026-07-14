import 'product.dart';

class CartItem {
  final Product product;
  int quantity;

  CartItem({
    required this.product,
    this.quantity = 1,
  });

  double get totalPrice => product.price * quantity;

  Map<String, dynamic> toJson() {
    return {
      'productId': product.id,
      'name': product.name,
      'price': product.price,
      'quantity': quantity,
      'isAgeRestricted': product.isAgeRestricted,
    };
  }
}

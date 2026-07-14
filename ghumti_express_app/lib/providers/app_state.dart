import 'package:flutter/material.dart';
import '../models/user.dart';
import '../models/product.dart';
import '../models/cart_item.dart';
import '../services/api_service.dart';

class AppState extends ChangeNotifier {
  User? _currentUser;
  final List<CartItem> _cartItems = [];
  String _errorMessage = '';

  User? get currentUser => _currentUser;
  List<CartItem> get cartItems => _cartItems;
  String get errorMessage => _errorMessage;

  bool get isAuthenticated => _currentUser != null;

  double get subtotal => _cartItems.fold(0.0, (sum, item) => sum + item.totalPrice);
  double get tax => double.parse((subtotal * 0.13).toStringAsFixed(2));
  double get deliveryFee => _cartItems.isEmpty ? 0.0 : 150.0;
  double get totalAmount => subtotal + tax + deliveryFee;

  int get cartCount => _cartItems.fold(0, (sum, item) => sum + item.quantity);

  void setBaseUrl(String url) {
    ApiService.setBaseUrl(url);
    notifyListeners();
  }

  String get baseUrl => ApiService.baseUrl;

  void logout() {
    _currentUser = null;
    _cartItems.clear();
    notifyListeners();
  }

  void setUser(User user) {
    _currentUser = user;
    notifyListeners();
  }

  // Add product to cart with age verification checks
  String? addToCart(Product product) {
    if (product.isAgeRestricted) {
      if (_currentUser == null) {
        return 'Please login to purchase age-restricted items.';
      }
      if (!_currentUser!.isOfAge) {
        return 'Access Denied: You must be at least 18 years old to purchase age-restricted items.';
      }
    }

    final existingIndex = _cartItems.indexWhere((item) => item.product.id == product.id);
    if (existingIndex >= 0) {
      if (_cartItems[existingIndex].quantity >= product.stock) {
        return 'Cannot add more. Restocking needed (Stock limit reached).';
      }
      _cartItems[existingIndex].quantity++;
    } else {
      if (product.stock < 1) {
        return 'Out of stock.';
      }
      _cartItems.add(CartItem(product: product, quantity: 1));
    }
    
    notifyListeners();
    return null; // No error
  }

  void removeFromCart(Product product) {
    final existingIndex = _cartItems.indexWhere((item) => item.product.id == product.id);
    if (existingIndex >= 0) {
      if (_cartItems[existingIndex].quantity > 1) {
        _cartItems[existingIndex].quantity--;
      } else {
        _cartItems.removeAt(existingIndex);
      }
      notifyListeners();
    }
  }

  void deleteFromCart(Product product) {
    _cartItems.removeWhere((item) => item.product.id == product.id);
    notifyListeners();
  }

  void clearCart() {
    _cartItems.clear();
    notifyListeners();
  }
}

import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import '../models/user.dart';
import '../models/product.dart';
import '../models/category.dart';
import '../models/order.dart';

class ApiService {
  static String _baseUrl = 'http://ghumti.4-193-121-134.sslip.io';

  static String get baseUrl => _baseUrl;

  static void setBaseUrl(String url) {
    if (url.endsWith('/')) {
      _baseUrl = url.substring(0, url.length - 1);
    } else {
      _baseUrl = url;
    }
  }

  // Authentication
  static Future<User> login(String username, String password) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/auth/login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'password': password,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return User.fromJson(data['user']);
    } else {
      throw Exception(data['error'] ?? 'Login failed');
    }
  }

  static Future<User> signup(String username, String password, String dob) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/auth/signup'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'username': username,
        'password': password,
        'dob': dob,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return User.fromJson(data['user']);
    } else {
      throw Exception(data['error'] ?? 'Sign up failed');
    }
  }

  // Catalog
  static Future<List<Category>> fetchCategories() async {
    final response = await http.get(Uri.parse('$_baseUrl/api/categories'));
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((c) => Category.fromJson(c)).toList();
    } else {
      throw Exception('Failed to fetch categories');
    }
  }

  static Future<List<Subcategory>> fetchSubcategories() async {
    final response = await http.get(Uri.parse('$_baseUrl/api/subcategories'));
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((sc) => Subcategory.fromJson(sc)).toList();
    } else {
      throw Exception('Failed to fetch subcategories');
    }
  }

  static Future<List<Product>> fetchProducts() async {
    final response = await http.get(Uri.parse('$_baseUrl/api/products'));
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((p) => Product.fromJson(p)).toList();
    } else {
      throw Exception('Failed to fetch products');
    }
  }

  // Checkout
  static Future<Map<String, dynamic>> checkout(
      String username, List<Map<String, dynamic>> items) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/checkout'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'user': {'username': username},
        'items': items,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200) {
      return data;
    } else {
      throw Exception(data['error'] ?? 'Checkout failed');
    }
  }

  // Payment Initiation
  static Future<Map<String, dynamic>> initiatePayment(
      String orderId, String gateway) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/payment/initiate'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'orderId': orderId,
        'gateway': gateway,
      }),
    );

    final data = jsonDecode(response.body);
    if (response.statusCode == 200 && data['success'] == true) {
      return data;
    } else {
      throw Exception(data['error'] ?? 'Payment initiation failed');
    }
  }

  // Payment Callback Redirections (Simulated callbacks)
  static Future<bool> verifyEsewa(String encodedData) async {
    final response = await http.get(
      Uri.parse('$_baseUrl/api/payment/callback/esewa?data=$encodedData'),
    );
    return response.statusCode == 200 || response.body.contains('Success') || response.body.contains('success');
  }

  static Future<bool> verifyKhalti(
    String pidx,
    String txnId,
    double amount,
    String purchaseOrderId,
    String purchaseOrderName,
  ) async {
    final response = await http.get(
      Uri.parse(
        '$_baseUrl/api/payment/callback/khalti?pidx=$pidx&transaction_id=$txnId&amount=${amount.toInt()}&purchase_order_id=$purchaseOrderId&purchase_order_name=$purchaseOrderName',
      ),
    );
    return response.statusCode == 200 || response.body.contains('Success') || response.body.contains('success');
  }

  // Bank Voucher Upload
  static Future<bool> uploadBankVoucher(String orderId, File imageFile) async {
    var request = http.MultipartRequest(
      'POST',
      Uri.parse('$_baseUrl/api/payment/bank-upload'),
    );
    request.fields['orderId'] = orderId;
    request.files.add(
      await http.MultipartFile.fromPath('voucher', imageFile.path),
    );
    
    var streamedResponse = await request.send();
    var response = await http.Response.fromStream(streamedResponse);
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data['success'] == true;
    }
    return false;
  }

  // Fetch all orders
  static Future<List<Order>> fetchOrders() async {
    final response = await http.get(Uri.parse('$_baseUrl/api/orders'));
    if (response.statusCode == 200) {
      final List data = jsonDecode(response.body);
      return data.map((o) => Order.fromJson(o)).toList();
    } else {
      throw Exception('Failed to fetch orders');
    }
  }

  // Operator dispatching (warehouse/barista)
  static Future<bool> dispatchOrder(String orderId, String role) async {
    final Map<String, dynamic> body = {};
    if (role == 'warehouse') {
      body['warehouseCompleted'] = true;
    } else if (role == 'barista') {
      body['baristaCompleted'] = true;
    }
    final response = await http.post(
      Uri.parse('$_baseUrl/api/orders/$orderId/dispatch'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode(body),
    );
    return response.statusCode == 200;
  }

  // Rider complete (doorstep age check)
  static Future<bool> completeOrder(
      String orderId, String idType, String idNumber) async {
    final response = await http.post(
      Uri.parse('$_baseUrl/api/orders/$orderId/complete'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'driverConfirmedAge': true,
        'idType': idType,
        'idNumber': idNumber,
      }),
    );
    return response.statusCode == 200;
  }
}

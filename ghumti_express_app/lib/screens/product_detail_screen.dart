import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:http/http.dart' as http;
import '../providers/app_state.dart';
import '../models/product.dart';

class ProductDetailScreen extends StatefulWidget {
  final Product product;

  const ProductDetailScreen({super.key, required this.product});

  @override
  State<ProductDetailScreen> createState() => _ProductDetailScreenState();
}

class _ProductDetailScreenState extends State<ProductDetailScreen> {
  List<dynamic> _reviews = [];
  bool _isLoadingReviews = true;
  final _commentController = TextEditingController();
  int _rating = 5;

  @override
  void initState() {
    super.initState();
    _loadReviews();
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _loadReviews() async {
    setState(() => _isLoadingReviews = true);
    final baseUrl = Provider.of<AppState>(context, listen: false).baseUrl;
    try {
      final response = await http.get(Uri.parse('$baseUrl/api/products/${widget.product.id}/reviews'));
      if (response.statusCode == 200) {
        setState(() {
          _reviews = jsonDecode(response.body);
        });
      }
    } catch (_) {} finally {
      setState(() => _isLoadingReviews = false);
    }
  }

  Future<void> _submitReview() async {
    final appState = Provider.of<AppState>(context, listen: false);
    if (!appState.isAuthenticated) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please log in to submit a review.')),
      );
      return;
    }

    final comment = _commentController.text.trim();
    if (comment.isEmpty) return;

    try {
      final response = await http.post(
        Uri.parse('${appState.baseUrl}/api/products/${widget.product.id}/reviews'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'username': appState.currentUser!.username,
          'rating': _rating,
          'comment': comment,
        }),
      );
      if (response.statusCode == 200) {
        _commentController.clear();
        _loadReviews();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Review submitted!')),
        );
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final product = widget.product;

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        foregroundColor: Colors.white,
        title: Text(product.name),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Product Image
            Container(
              height: 250,
              color: const Color(0xFF1E1E1E),
              child: product.imageUrl.isNotEmpty
                  ? Image.network(
                      product.imageUrl.startsWith('http')
                          ? product.imageUrl
                          : '${appState.baseUrl}${product.imageUrl}',
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => const Icon(Icons.image, size: 100, color: Colors.grey),
                    )
                  : const Icon(Icons.image, size: 100, color: Colors.grey),
            ),
            Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title and restrict badge
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Text(
                          product.name,
                          style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: Colors.white),
                        ),
                      ),
                      if (product.isAgeRestricted)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.redAccent,
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: const Text(
                            'AGE RESTRICTED',
                            style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  // Price and rating row
                  Row(
                    children: [
                      Text(
                        'NPR ${product.price.toStringAsFixed(2)}',
                        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.amber),
                      ),
                      const SizedBox(width: 8),
                      if (product.mrp > product.price)
                        Text(
                          'NPR ${product.mrp.toStringAsFixed(2)}',
                          style: const TextStyle(
                            fontSize: 14,
                            decoration: TextDecoration.lineThrough,
                            color: Colors.grey,
                          ),
                        ),
                      const Spacer(),
                      const Icon(Icons.star, color: Colors.amber, size: 18),
                      const SizedBox(width: 4),
                      Text(
                        '${product.averageRating.toStringAsFixed(1)} (${product.ratingCount} reviews)',
                        style: const TextStyle(color: Colors.white70, fontSize: 13),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Age Restriction Lock Warning Block
                  if (product.isAgeRestricted) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.redAccent.withOpacity(0.5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.warning_amber_rounded, color: Colors.redAccent),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'This item contains alcohol. Adding to cart requires you to be at least 18 years of age. A physical ID must be checked at the door by the rider.',
                              style: TextStyle(color: Colors.grey[300], fontSize: 12),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  // Stock
                  Text(
                    product.stock > 0 ? 'In Stock: ${product.stock} items remaining' : 'Out of Stock',
                    style: TextStyle(
                      color: product.stock > 0 ? Colors.greenAccent : Colors.redAccent,
                      fontWeight: FontWeight.bold,
                      fontSize: 14,
                    ),
                  ),
                  const SizedBox(height: 24),
                  SizedBox(
                    width: double.infinity,
                    child: ElevatedButton(
                      onPressed: () {
                        final err = appState.addToCart(product);
                        if (err != null) {
                          showDialog(
                            context: context,
                            builder: (ctx) => AlertDialog(
                              backgroundColor: const Color(0xFF1E1E1E),
                              title: const Text('Access Denied', style: TextStyle(color: Colors.redAccent)),
                              content: Text(err, style: const TextStyle(color: Colors.white)),
                              actions: [
                                TextButton(
                                  onPressed: () => Navigator.of(ctx).pop(),
                                  child: const Text('OK', style: TextStyle(color: Colors.amber)),
                                ),
                              ],
                            ),
                          );
                        } else {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('${product.name} added to cart!')),
                          );
                        }
                      },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.amber,
                        foregroundColor: Colors.black,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: const Text(
                        'ADD TO CART',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                      ),
                    ),
                  ),
                  const SizedBox(height: 32),
                  // Reviews Title
                  const Text(
                    'Customer Reviews',
                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white),
                  ),
                  const SizedBox(height: 12),
                  // Write Review Section
                  if (appState.isAuthenticated) ...[
                    Card(
                      color: const Color(0xFF1E1E1E),
                      child: Padding(
                        padding: const EdgeInsets.all(12.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            Row(
                              children: [
                                const Text('Your Rating: ', style: TextStyle(color: Colors.white)),
                                DropdownButton<int>(
                                  dropdownColor: const Color(0xFF1E1E1E),
                                  value: _rating,
                                  items: [5, 4, 3, 2, 1].map((r) {
                                    return DropdownMenuItem(
                                      value: r,
                                      child: Text('$r Stars', style: const TextStyle(color: Colors.white)),
                                    );
                                  }).toList(),
                                  onChanged: (val) {
                                    if (val != null) setState(() => _rating = val);
                                  },
                                ),
                              ],
                            ),
                            TextField(
                              controller: _commentController,
                              style: const TextStyle(color: Colors.white),
                              decoration: const InputDecoration(
                                hintText: 'Write your comment...',
                                hintStyle: TextStyle(color: Colors.grey),
                                enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                                focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.amber)),
                              ),
                            ),
                            const SizedBox(height: 8),
                            Align(
                              alignment: Alignment.centerRight,
                              child: ElevatedButton(
                                onPressed: _submitReview,
                                style: ElevatedButton.styleFrom(
                                  backgroundColor: Colors.amber,
                                  foregroundColor: Colors.black,
                                ),
                                child: const Text('Submit'),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  // Review List
                  _isLoadingReviews
                      ? const Center(child: CircularProgressIndicator(color: Colors.amber))
                      : _reviews.isEmpty
                          ? const Text('No reviews yet. Be the first to review!', style: TextStyle(color: Colors.grey))
                          : ListView.builder(
                              shrinkWrap: true,
                              physics: const NeverScrollableScrollPhysics(),
                              itemCount: _reviews.length,
                              itemBuilder: (context, idx) {
                                final rev = _reviews[idx];
                                return Card(
                                  color: const Color(0xFF1A1A1A),
                                  margin: const EdgeInsets.symmetric(vertical: 4),
                                  child: ListTile(
                                    title: Text(rev['username'] ?? 'Anonymous', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
                                    subtitle: Text(rev['comment'] ?? '', style: const TextStyle(color: Colors.grey)),
                                    trailing: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: List.generate(5, (starIdx) {
                                        return Icon(
                                          Icons.star,
                                          size: 14,
                                          color: starIdx < (rev['rating'] ?? 5) ? Colors.amber : Colors.grey[700],
                                        );
                                      }),
                                    ),
                                  ),
                                );
                              },
                            ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

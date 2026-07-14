import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../models/product.dart';
import '../models/category.dart';
import '../services/api_service.dart';
import 'auth_screen.dart';
import 'cart_screen.dart';
import 'product_detail_screen.dart';
import 'operator_split_screen.dart';
import 'rider_handoff_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Product> _allProducts = [];
  List<Product> _filteredProducts = [];
  List<Category> _categories = [];
  List<Subcategory> _subcategories = [];
  
  int? _selectedCategoryId;
  int? _selectedSubcategoryId;
  String _searchQuery = '';
  bool _isLoading = true;
  String _errorMessage = '';

  final _ipController = TextEditingController();

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  @override
  void dispose() {
    _ipController.dispose();
    super.dispose();
  }

  Future<void> _loadData() async {
    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });
    try {
      final categories = await ApiService.fetchCategories();
      final subcategories = await ApiService.fetchSubcategories();
      final products = await ApiService.fetchProducts();
      
      setState(() {
        _categories = categories;
        _subcategories = subcategories;
        _allProducts = products;
        _applyFilters();
      });
    } catch (e) {
      setState(() => _errorMessage = 'Failed to load catalog from server. Check your connection or IP configuration.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _applyFilters() {
    setState(() {
      _filteredProducts = _allProducts.where((product) {
        final matchesCategory = _selectedCategoryId == null || product.categoryId == _selectedCategoryId;
        final matchesSubcategory = _selectedSubcategoryId == null || product.subcategoryId == _selectedSubcategoryId;
        final matchesSearch = product.name.toLowerCase().contains(_searchQuery.toLowerCase());
        return matchesCategory && matchesSubcategory && matchesSearch;
      }).toList();
    });
  }

  void _showIpConfigDialog() {
    _ipController.text = Provider.of<AppState>(context, listen: false).baseUrl;
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          backgroundColor: const Color(0xFF1E1E1E),
          title: const Text('Configure Backend IP', style: TextStyle(color: Colors.white)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                'Enter Node.js server base URL. Use http://10.0.2.2:5005 for local emulator or http://<your-local-ip>:5005',
                style: TextStyle(color: Colors.grey[400], fontSize: 13),
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _ipController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  enabledBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.amber)),
                  focusedBorder: UnderlineInputBorder(borderSide: BorderSide(color: Colors.amber)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.of(context).pop(),
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
            ),
            TextButton(
              onPressed: () {
                final newUrl = _ipController.text.trim();
                if (newUrl.isNotEmpty) {
                  Provider.of<AppState>(context, listen: false).setBaseUrl(newUrl);
                  Navigator.of(context).pop();
                  _loadData();
                }
              },
              child: const Text('Save', style: TextStyle(color: Colors.amber)),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final appState = Provider.of<AppState>(context);
    final user = appState.currentUser;

    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      appBar: AppBar(
        backgroundColor: const Color(0xFF1A1A1A),
        foregroundColor: Colors.white,
        title: const Text('Ghumti Express', style: TextStyle(fontWeight: FontWeight.bold, color: Colors.amber)),
        actions: [
          IconButton(
            icon: const Icon(Icons.settings),
            onPressed: _showIpConfigDialog,
            tooltip: 'Configure Backend IP',
          ),
          Stack(
            alignment: Alignment.center,
            children: [
              IconButton(
                icon: const Icon(Icons.shopping_cart),
                onPressed: () {
                  Navigator.of(context).push(
                    MaterialPageRoute(builder: (_) => const CartScreen()),
                  );
                },
              ),
              if (appState.cartCount > 0)
                Positioned(
                  right: 4,
                  top: 4,
                  child: Container(
                    padding: const EdgeInsets.all(2),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    constraints: const BoxConstraints(
                      minWidth: 16,
                      minHeight: 16,
                    ),
                    child: Text(
                      '${appState.cartCount}',
                      style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                      textAlign: TextAlign.center,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
      drawer: Drawer(
        backgroundColor: const Color(0xFF1E1E1E),
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            UserAccountsDrawerHeader(
              decoration: const BoxDecoration(color: Color(0xFF1A1A1A)),
              currentAccountPicture: const CircleAvatar(
                backgroundColor: Colors.amber,
                child: Icon(Icons.person, color: Colors.black, size: 36),
              ),
              accountName: Text(user?.username ?? 'Guest User', style: const TextStyle(fontWeight: FontWeight.bold)),
              accountEmail: Text('Role: ${user?.role ?? 'None'} | Age: ${user?.age ?? 'Unknown'}'),
            ),
            ListTile(
              leading: const Icon(Icons.store, color: Colors.amber),
              title: const Text('Shop Catalog', style: TextStyle(color: Colors.white)),
              onTap: () {
                Navigator.of(context).pop();
              },
            ),
            // Operator split queues view
            ListTile(
              leading: const Icon(Icons.playlist_add_check_circle, color: Colors.amber),
              title: const Text('Operator splitting views', style: TextStyle(color: Colors.white)),
              subtitle: const Text('Warehouse / Barista Splitting Queues', style: TextStyle(color: Colors.grey, fontSize: 11)),
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const OperatorSplitScreen()),
                );
              },
            ),
            // Rider Delivery view
            ListTile(
              leading: const Icon(Icons.delivery_dining, color: Colors.amber),
              title: const Text('Rider Delivery views', style: TextStyle(color: Colors.white)),
              subtitle: const Text('Doorstep handoff & Age check', style: TextStyle(color: Colors.grey, fontSize: 11)),
              onTap: () {
                Navigator.of(context).pop();
                Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const RiderHandoffScreen()),
                );
              },
            ),
            const Divider(color: Colors.grey),
            ListTile(
              leading: const Icon(Icons.logout, color: Colors.redAccent),
              title: const Text('Log Out', style: TextStyle(color: Colors.redAccent)),
              onTap: () {
                appState.logout();
                Navigator.of(context).pushReplacement(
                  MaterialPageRoute(builder: (_) => const AuthScreen()),
                );
              },
            ),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Colors.amber))
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Welcome User Header
                Padding(
                  padding: const EdgeInsets.fromLTRB(16.0, 16.0, 16.0, 4.0),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Welcome',
                              style: TextStyle(
                                fontSize: 14,
                                color: Colors.grey[500],
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              user?.fullName != null && user!.fullName!.isNotEmpty
                                  ? user.fullName!
                                  : (user?.username ?? 'Guest'),
                              style: const TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Colors.white,
                              ),
                            ),
                          ],
                        ),
                      ),
                      CircleAvatar(
                        backgroundColor: Colors.amber.withOpacity(0.1),
                        radius: 20,
                        child: const Icon(
                          Icons.waving_hand,
                          color: Colors.amber,
                          size: 20,
                        ),
                      ),
                    ],
                  ),
                ),
                // Search bar
                Padding(
                  padding: const EdgeInsets.all(12.0),
                  child: TextField(
                    onChanged: (val) {
                      _searchQuery = val;
                      _applyFilters();
                    },
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: 'Search groceries, whiskey, coffee...',
                      hintStyle: TextStyle(color: Colors.grey[500]),
                      prefixIcon: const Icon(Icons.search, color: Colors.amber),
                      filled: true,
                      fillColor: const Color(0xFF1E1E1E),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                        borderSide: BorderSide.none,
                      ),
                    ),
                  ),
                ),
                // Category Chip Filters
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.symmetric(horizontal: 12.0),
                  child: Row(
                    children: [
                      FilterChip(
                        label: const Text('All'),
                        selected: _selectedCategoryId == null,
                        selectedColor: Colors.amber,
                        backgroundColor: const Color(0xFF1E1E1E),
                        checkmarkColor: Colors.black,
                        labelStyle: TextStyle(color: _selectedCategoryId == null ? Colors.black : Colors.white),
                        onSelected: (_) {
                          setState(() {
                            _selectedCategoryId = null;
                            _selectedSubcategoryId = null;
                            _applyFilters();
                          });
                        },
                      ),
                      const SizedBox(width: 8),
                      ..._categories.map((cat) {
                        final isSelected = _selectedCategoryId == cat.id;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: FilterChip(
                            label: Text(cat.name),
                            selected: isSelected,
                            selectedColor: Colors.amber,
                            backgroundColor: const Color(0xFF1E1E1E),
                            checkmarkColor: Colors.black,
                            labelStyle: TextStyle(color: isSelected ? Colors.black : Colors.white),
                            onSelected: (_) {
                              setState(() {
                                _selectedCategoryId = cat.id;
                                _selectedSubcategoryId = null;
                                _applyFilters();
                              });
                            },
                          ),
                        );
                      }),
                    ],
                  ),
                ),
                // Subcategory filters (only if category selected)
                if (_selectedCategoryId != null) ...[
                  const SizedBox(height: 8),
                  SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 12.0),
                    child: Row(
                      children: _subcategories
                          .where((sc) => sc.categoryId == _selectedCategoryId)
                          .map((sc) {
                        final isSelected = _selectedSubcategoryId == sc.id;
                        return Padding(
                          padding: const EdgeInsets.only(right: 8.0),
                          child: ChoiceChip(
                            label: Text(sc.name, style: TextStyle(fontSize: 12, color: isSelected ? Colors.black : Colors.white)),
                            selected: isSelected,
                            selectedColor: Colors.amber,
                            backgroundColor: const Color(0xFF2A2A2A),
                            onSelected: (_) {
                              setState(() {
                                _selectedSubcategoryId = isSelected ? null : sc.id;
                                _applyFilters();
                              });
                            },
                          ),
                        );
                      }).toList(),
                    ),
                  ),
                ],
                const SizedBox(height: 12),
                // Error state or product grid
                Expanded(
                  child: _errorMessage.isNotEmpty
                      ? Padding(
                          padding: const EdgeInsets.all(24.0),
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                              const SizedBox(height: 12),
                              Text(
                                _errorMessage,
                                textAlign: TextAlign.center,
                                style: const TextStyle(color: Colors.white),
                              ),
                              const SizedBox(height: 16),
                              ElevatedButton(
                                onPressed: _loadData,
                                style: ElevatedButton.styleFrom(backgroundColor: Colors.amber, foregroundColor: Colors.black),
                                child: const Text('Try Again'),
                              ),
                            ],
                          ),
                        )
                      : _filteredProducts.isEmpty
                          ? const Center(child: Text('No products match filters.', style: TextStyle(color: Colors.grey)))
                          : GridView.builder(
                              padding: const EdgeInsets.all(12),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 0.72,
                                crossAxisSpacing: 12,
                                mainAxisSpacing: 12,
                              ),
                              itemCount: _filteredProducts.length,
                              itemBuilder: (context, index) {
                                final product = _filteredProducts[index];
                                return GestureDetector(
                                  onTap: () {
                                    Navigator.of(context).push(
                                      MaterialPageRoute(
                                        builder: (_) => ProductDetailScreen(product: product),
                                      ),
                                    );
                                  },
                                  child: Card(
                                    color: const Color(0xFF1E1E1E),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.stretch,
                                      children: [
                                        // Product Image
                                        Expanded(
                                          child: Stack(
                                            fit: StackFit.expand,
                                            children: [
                                              ClipRRect(
                                                borderRadius: const BorderRadius.vertical(top: Radius.circular(12)),
                                                child: product.imageUrl.isNotEmpty
                                                    ? Image.network(
                                                        product.imageUrl.startsWith('http')
                                                            ? product.imageUrl
                                                            : '${appState.baseUrl}${product.imageUrl}',
                                                        fit: BoxFit.cover,
                                                        errorBuilder: (_, __, ___) => const Icon(Icons.image, size: 64, color: Colors.grey),
                                                      )
                                                    : const Icon(Icons.image, size: 64, color: Colors.grey),
                                              ),
                                              if (product.isAgeRestricted)
                                                Positioned(
                                                  left: 8,
                                                  top: 8,
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                                    decoration: BoxDecoration(
                                                      color: Colors.redAccent,
                                                      borderRadius: BorderRadius.circular(4),
                                                    ),
                                                    child: const Text(
                                                      '18+',
                                                      style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                        ),
                                        // Details
                                        Padding(
                                          padding: const EdgeInsets.all(8.0),
                                          child: Column(
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                product.name,
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.white),
                                              ),
                                              const SizedBox(height: 4),
                                              Text(
                                                'NPR ${product.price.toStringAsFixed(2)}',
                                                style: const TextStyle(color: Colors.amber, fontWeight: FontWeight.bold),
                                              ),
                                              const SizedBox(height: 8),
                                              Row(
                                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                                children: [
                                                  Text(
                                                    product.stock > 0 ? 'Stock: ${product.stock}' : 'Out of stock',
                                                    style: TextStyle(
                                                      color: product.stock > 0 ? Colors.grey[400] : Colors.redAccent,
                                                      fontSize: 11,
                                                    ),
                                                  ),
                                                  InkWell(
                                                    onTap: () {
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
                                                          SnackBar(
                                                            content: Text('${product.name} added to cart!'),
                                                            duration: const Duration(seconds: 1),
                                                          ),
                                                        );
                                                      }
                                                    },
                                                    child: Container(
                                                      padding: const EdgeInsets.all(6),
                                                      decoration: const BoxDecoration(
                                                        color: Colors.amber,
                                                        shape: BoxShape.circle,
                                                      ),
                                                      child: const Icon(Icons.add_shopping_cart, size: 16, color: Colors.black),
                                                    ),
                                                  ),
                                                ],
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                );
                              },
                            ),
                ),
              ],
            ),
    );
  }
}

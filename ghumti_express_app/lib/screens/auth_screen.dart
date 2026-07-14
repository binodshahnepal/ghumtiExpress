import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';
import 'home_screen.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _fullNameController = TextEditingController();
  final _dobController = TextEditingController(); // YYYY-MM-DD
  bool _isLogin = true;
  bool _isLoading = false;
  String _errorMessage = '';

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _fullNameController.dispose();
    _dobController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final username = _usernameController.text.trim();
    final password = _passwordController.text.trim();
    final fullName = _fullNameController.text.trim();
    final dob = _dobController.text.trim();

    if (username.isEmpty || password.isEmpty) {
      setState(() => _errorMessage = 'Username and password cannot be empty.');
      return;
    }

    if (!_isLogin) {
      if (fullName.isEmpty) {
        setState(() => _errorMessage = 'Full Name is required for registration.');
        return;
      }
      if (dob.isEmpty) {
        setState(() => _errorMessage = 'Date of birth is required for registration.');
        return;
      }
    }

    // Validate DOB format (YYYY-MM-DD)
    if (!_isLogin) {
      final dobRegExp = RegExp(r'^\d{4}-\d{2}-\d{2}$');
      if (!dobRegExp.hasMatch(dob)) {
        setState(() => _errorMessage = 'Date of Birth must be in YYYY-MM-DD format.');
        return;
      }
      try {
        DateTime.parse(dob);
      } catch (_) {
        setState(() => _errorMessage = 'Invalid Date of Birth.');
        return;
      }
    }

    setState(() {
      _isLoading = true;
      _errorMessage = '';
    });

    try {
      final appState = Provider.of<AppState>(context, listen: false);
      if (_isLogin) {
        final user = await ApiService.login(username, password);
        appState.setUser(user);
      } else {
        final user = await ApiService.signup(username, password, fullName, dob);
        appState.setUser(user);
      }
      if (mounted) {
        Navigator.of(context).pushReplacement(
          MaterialPageRoute(builder: (_) => const HomeScreen()),
        );
      }
    } catch (e) {
      setState(() => _errorMessage = e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  Future<void> _selectDate() async {
    final DateTime? picked = await showDatePicker(
      context: context,
      initialDate: DateTime.now().subtract(const Duration(days: 365 * 18)),
      firstDate: DateTime(1900),
      lastDate: DateTime.now(),
      builder: (context, child) {
        return Theme(
          data: Theme.of(context).copyWith(
            colorScheme: const ColorScheme.dark(
              primary: Colors.amber,
              onPrimary: Colors.black,
              surface: Color(0xFF1E1E1E),
              onSurface: Colors.white,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() {
        _dobController.text =
            "${picked.year}-${picked.month.toString().padLeft(2, '0')}-${picked.day.toString().padLeft(2, '0')}";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Card(
            color: const Color(0xFF1E1E1E),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            elevation: 8,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 20.0, vertical: 32.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.local_shipping,
                    size: 64,
                    color: Colors.amber,
                  ),
                  const SizedBox(height: 12),
                  const Text(
                    'Ghumti Express',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _isLogin ? 'Quick Commerce Gateway' : 'Create New Account',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontSize: 14,
                      color: Colors.grey[400],
                    ),
                  ),
                  const SizedBox(height: 32),
                  if (_errorMessage.isNotEmpty) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withOpacity(0.2),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.redAccent),
                      ),
                      child: Text(
                        _errorMessage,
                        style: const TextStyle(color: Colors.redAccent),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  if (!_isLogin) ...[
                    TextField(
                      controller: _fullNameController,
                      style: const TextStyle(color: Colors.white),
                      decoration: InputDecoration(
                        labelText: 'Full Name',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        prefixIcon: const Icon(Icons.badge, color: Colors.amber),
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.grey[700]!),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderSide: const BorderSide(color: Colors.amber),
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],
                  TextField(
                    controller: _usernameController,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Username',
                      labelStyle: TextStyle(color: Colors.grey[400]),
                      prefixIcon: const Icon(Icons.person, color: Colors.amber),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: Colors.grey[700]!),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.amber),
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                  TextField(
                    controller: _passwordController,
                    obscureText: true,
                    style: const TextStyle(color: Colors.white),
                    decoration: InputDecoration(
                      labelText: 'Password',
                      labelStyle: TextStyle(color: Colors.grey[400]),
                      prefixIcon: const Icon(Icons.lock, color: Colors.amber),
                      enabledBorder: OutlineInputBorder(
                        borderSide: BorderSide(color: Colors.grey[700]!),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      focusedBorder: OutlineInputBorder(
                        borderSide: const BorderSide(color: Colors.amber),
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  if (!_isLogin) ...[
                    const SizedBox(height: 16),
                    TextField(
                      controller: _dobController,
                      style: const TextStyle(color: Colors.white),
                      readOnly: true,
                      onTap: _selectDate,
                      decoration: InputDecoration(
                        labelText: 'Date of Birth (YYYY-MM-DD)',
                        labelStyle: TextStyle(color: Colors.grey[400]),
                        prefixIcon: const Icon(Icons.cake, color: Colors.amber),
                        suffixIcon: const Icon(Icons.calendar_month, color: Colors.amber),
                        enabledBorder: OutlineInputBorder(
                          borderSide: BorderSide(color: Colors.grey[700]!),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderSide: const BorderSide(color: Colors.amber),
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                    ),
                  ],
                  const SizedBox(height: 32),
                  ElevatedButton(
                    onPressed: _isLoading ? null : _submit,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.amber,
                      foregroundColor: Colors.black,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: _isLoading
                        ? const SizedBox(
                            height: 20,
                            width: 20,
                            child: CircularProgressIndicator(
                              color: Colors.black,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            _isLogin ? 'Login' : 'Register',
                            style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                          ),
                  ),
                  const SizedBox(height: 16),
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _isLogin = !_isLogin;
                        _errorMessage = '';
                      });
                    },
                    child: Text(
                      _isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login',
                      style: const TextStyle(color: Colors.amber),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

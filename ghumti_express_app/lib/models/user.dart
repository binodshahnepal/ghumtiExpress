class User {
  final int id;
  final String username;
  final String? dob;
  final String role;
  final String? token;

  User({
    required this.id,
    required this.username,
    this.dob,
    required this.role,
    this.token,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] ?? 0,
      username: json['username'] ?? '',
      dob: json['dob'],
      role: json['role'] ?? 'Customer',
      token: json['token'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'username': username,
      'role': role,
      'dob': dob,
      'token': token,
    };
  }

  int get age {
    if (dob == null || dob!.isEmpty) return 0;
    try {
      DateTime birthDate = DateTime.parse(dob!);
      DateTime today = DateTime.now();
      int age = today.year - birthDate.year;
      if (today.month < birthDate.month ||
          (today.month == birthDate.month && today.day < birthDate.day)) {
        age--;
      }
      return age;
    } catch (_) {
      return 0;
    }
  }

  bool get isOfAge => age >= 18;
}

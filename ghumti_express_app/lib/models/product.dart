class Product {
  final int id;
  final String name;
  final int categoryId;
  final int subcategoryId;
  final double price;
  final double originalPrice;
  final double costPrice;
  final double mrp;
  final int stock;
  final bool isAgeRestricted;
  final String imageUrl;
  final double averageRating;
  final int ratingCount;

  Product({
    required this.id,
    required this.name,
    required this.categoryId,
    required this.subcategoryId,
    required this.price,
    required this.originalPrice,
    required this.costPrice,
    required this.mrp,
    required this.stock,
    required this.isAgeRestricted,
    required this.imageUrl,
    required this.averageRating,
    required this.ratingCount,
  });

  factory Product.fromJson(Map<String, dynamic> json) {
    return Product(
      id: json['id'] ?? 0,
      name: json['name'] ?? '',
      categoryId: json['categoryId'] ?? 0,
      subcategoryId: json['subcategoryId'] ?? 0,
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      originalPrice: (json['originalPrice'] as num?)?.toDouble() ?? 0.0,
      costPrice: (json['costPrice'] as num?)?.toDouble() ?? 0.0,
      mrp: (json['mrp'] as num?)?.toDouble() ?? 0.0,
      stock: json['stock'] ?? 0,
      isAgeRestricted: (json['isAgeRestricted'] == 1 || json['isAgeRestricted'] == true),
      imageUrl: json['imageUrl'] ?? '',
      averageRating: (json['averageRating'] as num?)?.toDouble() ?? 0.0,
      ratingCount: json['ratingCount'] ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'categoryId': categoryId,
      'subcategoryId': subcategoryId,
      'price': price,
      'originalPrice': originalPrice,
      'costPrice': costPrice,
      'mrp': mrp,
      'stock': stock,
      'isAgeRestricted': isAgeRestricted ? 1 : 0,
      'imageUrl': imageUrl,
      'averageRating': averageRating,
      'ratingCount': ratingCount,
    };
  }
}

const dummyFoodItems = [
  {
    "name": "Grilled Chicken Salad",
    "price": 10.99,
    "expiryDate": "2024-11-23T12:00:00Z",
    "description": "A healthy salad with grilled chicken, fresh greens, and a tangy vinaigrette.",
    "type": "non-veg",
    "category": "salads",
    "delivery":"2024-11-23T09:00:00Z",
    "serves": 2,
    "tags": ["low-calorie", "protein-rich", "gluten-free"],
    "apartmentId": 1
  },
  {
    "name": "Veggie Delight Pizza",
    "price": 8.99,
    "expiryDate": "2024-11-22T20:00:00Z",
    "description": "A cheesy pizza loaded with bell peppers, olives, and mushrooms.",
    "type": "veg",
    "category": "main-course",
    "serves": 3,
    "tags": ["vegetarian", "kids-favorite", "cheesy"],
    "apartmentId": 1
  },
  {
    "name": "Mango Smoothie",
    "price": 4.99,
    "expiryDate": "2024-11-22T18:00:00Z",
    "description": "A refreshing mango smoothie with a hint of honey and yogurt.",
    "type": "veg",
    "category": "beverages",
    "serves": 1,
    "tags": ["summer-special", "healthy-drink", "fruit-based"],
    "apartmentId": 1
  },
  {
    "name": "Chocolate Brownie",
    "price": 3.99,
    "expiryDate": "2024-11-23T15:00:00Z",
    "description": "A rich and fudgy brownie topped with chocolate ganache.",
    "type": "veg",
    "category": "desserts",
    "serves": 1,
    "tags": ["chocolate", "sweet", "baked"],
    "apartmentId": 1
  },
  {
    "name": "Spicy Chicken Wings",
    "price": 7.99,
    "expiryDate": "2024-11-22T22:00:00Z",
    "description": "Crispy chicken wings coated in a spicy barbecue sauce.",
    "type": "non-veg",
    "category": "starters",
    "delivery":"2024-11-23T09:00:00Z",
    "serves": 2,
    "tags": ["spicy", "snack", "grilled"],
    "apartmentId": 1
  },
  {
    "name": "Paneer Butter Masala",
    "price": 9.99,
    "expiryDate": "2024-11-23T21:00:00Z",
    "description": "Soft paneer cubes cooked in a rich and creamy tomato gravy.",
    "type": "veg",
    "category": "main-course",
    "delivery":"2024-11-23T09:00:00Z",
    "serves": 2,
    "tags": ["indian", "vegetarian", "spicy"],
    "apartmentId": 1
  },
  {
    "name": "Strawberry Cheesecake",
    "price": 6.99,
    "expiryDate": "2024-11-24T12:00:00Z",
    "description": "A creamy cheesecake topped with fresh strawberries and a biscuit crust.",
    "type": "veg",
    "category": "desserts",
    "serves": 2,
    "tags": ["sweet", "fruity", "baked"],
    "apartmentId": 1
  },
  {
    "name": "Prawn Fried Rice",
    "price": 12.99,
    "expiryDate": "2024-11-23T19:00:00Z",
    "description": "A flavorful fried rice loaded with juicy prawns and vegetables.",
    "type": "non-veg",
    "category": "main-course",
    "delivery":"2024-11-23T09:00:00Z",
    "serves": 3,
    "tags": ["seafood", "spicy", "asian"],
    "apartmentId": 1
  },
  {
    "name": "Crispy Veg Spring Rolls",
    "price": 5.99,
    "expiryDate": "2024-11-22T19:00:00Z",
    "description": "Golden-fried spring rolls stuffed with crunchy vegetables.",
    "type": "veg",
    "category": "starters",
    "delivery":"2024-11-23T09:00:00Z",
    "serves": 2,
    "tags": ["crispy", "snack", "party-favorite"],
    "apartmentId": 1
  },
  {
    "name": "Tandoori Chicken",
    "price": 14.99,
    "expiryDate": "2024-11-22T21:00:00Z",
    "description": "Marinated chicken roasted in a traditional tandoor oven.",
    "type": "non-veg",
    "category": "main-course",
    "serves": 4,
    "tags": ["indian", "spicy", "grilled"],
    "apartmentId": 1
  }
]

// Data Service
// Interacts with MERN backend to fetch products and suppliers from MongoDB Atlas

const API_BASE = 'http://localhost:5000/api';

/**
 * Fetch all products from MongoDB Atlas
 */
export async function fetchProducts() {
  try {
    const response = await fetch(`${API_BASE}/products`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.status === 'success') {
      return data.products;
    }
    throw new Error('API payload invalid');
  } catch (error) {
    console.error('Failed to fetch products from backend API:', error.message);
    throw error;
  }
}

/**
 * Fetch all suppliers from MongoDB Atlas
 */
export async function fetchSuppliers() {
  try {
    const response = await fetch(`${API_BASE}/suppliers`);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && data.status === 'success') {
      return data.suppliers;
    }
    throw new Error('API payload invalid');
  } catch (error) {
    console.error('Failed to fetch suppliers from backend API:', error.message);
    throw error;
  }
}

import type { Product } from '../types/product';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'prd-white-tee',
    imageUrl:
      'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=800',
    title: 'Beyaz Basic Tişört',
    price: 490,
    brand: 'Maison Nori',
    category: 'upper_body',
    garmentDescription: 'Beyaz basic pamuklu tişört, kısa kollu, sade kesim',
  },
  {
    id: 'prd-white-linen-shirt',
    imageUrl:
      'https://images.unsplash.com/photo-1596755094514-f87e34085b2c?w=800',
    title: 'Beyaz Keten Gömlek',
    price: 1299,
    brand: 'Luna Atelier',
    category: 'upper_body',
    garmentDescription: 'Beyaz keten gömlek, uzun kollu, rahat kalıp',
  },
  {
    id: 'prd-blue-jeans',
    imageUrl:
      'https://images.unsplash.com/photo-1542272604-787c3835535d?w=800',
    title: 'Mavi Kot Pantolon',
    price: 1890,
    brand: 'Blue Form',
    category: 'lower_body',
    garmentDescription: 'Mavi düz kesim kot pantolon',
  },
  {
    id: 'prd-black-leather-jacket',
    imageUrl:
      'https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800',
    title: 'Siyah Deri Ceket',
    price: 4590,
    brand: 'Atelier Noir',
    category: 'upper_body',
    garmentDescription: 'Siyah deri biker ceket, fermuarlı',
  },
];

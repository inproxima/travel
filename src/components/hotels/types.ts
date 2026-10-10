import type { Hotel } from "@/lib/models";

export type HotelSearchInput = {
  q: string;
  checkIn: string;
  checkOut: string;
  adults: number;
  childrenAges: number[];
  sort: "relevance" | "price" | "rating" | "reviews";
  maxPrice: number | null;
  minRating: 7 | 8 | 9 | null;
  hotelClass: number[];
  freeCancellation: boolean;
  vacationRentals: boolean;
};

export type HotelSearchResponse = {
  hotels: Hotel[];
  nextPageToken: string | null;
  nights: number;
  currency: string;
  credits: number;
};

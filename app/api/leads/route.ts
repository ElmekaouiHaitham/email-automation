// app/api/leads/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  const leads = [
    { id: 1, first_name: "John", last_name: "Doe", age: 35, zip: "90210", interest: "Life Insurance", email: "john@example.com", insight: "Recently searched for coverage options" },
    { id: 2, first_name: "Sarah", last_name: "Smith", age: 42, zip: "10011", interest: "Retirement Planning", email: "sarah@example.com", insight: "Interested in family protection" },
    { id: 3, first_name: "Carlos", last_name: "Diaz", age: 30, zip: "33101", interest: "New parent coverage", email: "carlos@example.com", insight: "New parent, looking to secure family" },
    { id: 4, first_name: "Aisha", last_name: "Khan", age: 29, zip: "02139", interest: "Term Life", email: "aisha@example.com", insight: "Compared term vs whole life" },
    { id: 5, first_name: "Mark", last_name: "Lee", age: 50, zip: "60605", interest: "Retirement & legacy", email: "mark@example.com", insight: "Wants legacy planning" },
    // add up to 10 as you like
  ];
  return NextResponse.json(leads);
}

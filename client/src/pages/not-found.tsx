import React from "react";
import { Link } from "wouter";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center">
      <h1 className="text-4xl font-bold">404 - Page Not Found</h1>
      <p className="mt-4 text-lg text-gray-600">
        The page you are looking for does not exist.
      </p>
      <Link href="/">
        <a className="mt-6 rounded-md bg-primary px-4 py-2 text-white hover:bg-primary/90">
          Return Home
        </a>
      </Link>
    </div>
  );
}
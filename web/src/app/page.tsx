import React from 'react';
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen relative flex flex-col items-center justify-center px-5 overflow-hidden">
      {/* Textured gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-purple-100 via-pink-50 to-purple-50"></div>
      
      {/* Noise texture overlay */}
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      ></div>
      
      {/* Blob shapes */}
      <div className="absolute top-20 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" style={{ animationDelay: '1s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }}></div>
      
      {/* Content */}
      <div className="relative z-10 text-center mb-8">
        <h1 className="text-7xl md:text-9xl font-semibold tracking-tight mb-4 bg-gradient-to-r from-purple-700 to-purple-900 bg-clip-text text-transparent">
          mutual
        </h1>
        <p className="text-xl md:text-3xl text-purple-900 tracking-tight">
          an AI social network done right
        </p>
      </div>

      <div className="relative z-10 flex gap-4">
        <Link href="/auth/login">
          <Button 
            variant="outline" 
            className="px-6 py-2 border-2 border-purple-600 text-purple-600 hover:bg-purple-50 hover:border-purple-700 hover:text-purple-700 transition-all"
          >
            Log In
          </Button>
        </Link>
        <Link href="/auth/signup">
          <Button className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200 transition-all">
            Sign Up
          </Button>
        </Link>
      </div>
    </div>
  );
}
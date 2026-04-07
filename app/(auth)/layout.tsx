"use client";

import { useState, useEffect } from "react";

const SHOWCASE_IMAGES = [
  "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80", // marketing creative
  "https://images.unsplash.com/photo-1626785774625-ddcddc3445e9?w=800&q=80", // neon brand
  "https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&q=80", // social media
  "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80", // analytics
];

const TESTIMONIALS = [
  {
    quote: "TwinLink replaced our entire creative team's first-draft process. We produce 10x more ad variations now.",
    name: "Sarah M.",
    title: "Head of Growth, DTC Brand",
  },
  {
    quote: "The AI Creative Director understands our brand better than most freelancers we've hired.",
    name: "Karim B.",
    title: "Marketing Director, Casablanca",
  },
  {
    quote: "We went from 2 ads per week to 50. Our ROAS improved 3x in the first month.",
    name: "Amine L.",
    title: "Founder, E-commerce",
  },
];

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % SHOWCASE_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const testimonial = TESTIMONIALS[currentSlide % TESTIMONIALS.length];

  return (
    <div className="min-h-screen flex bg-white">
      {/* Left panel — visual showcase */}
      <div className="hidden lg:flex lg:w-[45%] xl:w-[50%] relative overflow-hidden bg-[#0A0A0A]">
        {/* Slideshow */}
        {SHOWCASE_IMAGES.map((src, i) => (
          <div
            key={src}
            className="absolute inset-0 transition-opacity duration-1000 ease-in-out"
            style={{ opacity: i === currentSlide ? 1 : 0 }}
          >
            <img
              src={src}
              alt=""
              className="w-full h-full object-cover opacity-40"
            />
          </div>
        ))}

        {/* Dark overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/60" />

        {/* Content overlay */}
        <div className="relative z-10 flex flex-col justify-between h-full p-10">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img src="/logo.svg" alt="TwinLink" className="h-8 w-8 invert" />
            <span className="text-[18px] font-bold text-white tracking-tight">TwinLink</span>
          </div>

          {/* Testimonial */}
          <div className="max-w-lg">
            <p className="text-[22px] text-white/90 font-light leading-relaxed mb-6">
              &ldquo;{testimonial.quote}&rdquo;
            </p>
            <div>
              <p className="text-[15px] font-semibold text-white">{testimonial.name}</p>
              <p className="text-[13px] text-white/50">{testimonial.title}</p>
            </div>

            {/* Slide indicators */}
            <div className="flex gap-2 mt-8">
              {SHOWCASE_IMAGES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`h-1 rounded-full transition-all duration-500 ${
                    i === currentSlide ? "w-8 bg-white" : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">{children}</div>
      </div>
    </div>
  );
}

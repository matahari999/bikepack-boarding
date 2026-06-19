import { useState } from 'react';
import type { Lodging } from '../types';

interface LodgingCardProps {
  lodging: Lodging;
  onSelect: (lodging: Lodging) => void;
  isHighlighted: boolean;
  onHover: (id: string | null) => void;
}

export default function LodgingCard({ lodging, onSelect, isHighlighted, onHover }: LodgingCardProps) {
  const [imgIndex, setImgIndex] = useState(0);

  // Fallback check for old localStorage schemas
  const urls = lodging.imageUrls || ((lodging as any).imageUrl ? [(lodging as any).imageUrl] : []);

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (urls.length === 0) return;
    setImgIndex((prev) => (prev + 1) % urls.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (urls.length === 0) return;
    setImgIndex((prev) => (prev - 1 + urls.length) % urls.length);
  };

  return (
    <article 
      className={`lodging-card ${isHighlighted ? 'highlighted' : ''}`}
      onClick={() => onSelect(lodging)}
      onMouseEnter={() => onHover(lodging.id)}
      onMouseLeave={() => onHover(null)}
    >
      <div className="card-image-wrapper">
        <img src={urls[imgIndex] || 'https://images.unsplash.com/photo-1501555088652-021faa106b9b'} alt={lodging.name} className="card-image" />
        
        {/* Carousel controls */}
        {urls.length > 1 && (
          <>
            <button className="carousel-btn prev" onClick={prevImage}>
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <button className="carousel-btn next" onClick={nextImage}>
              <i className="fa-solid fa-chevron-right"></i>
            </button>
            <div className="carousel-dots">
              {urls.map((_, i) => (
                <div 
                  key={i} 
                  className={`carousel-dot ${i === imgIndex ? 'active' : ''}`}
                ></div>
              ))}
            </div>
          </>
        )}

        <div className="card-price-badge">
          <span>${lodging.pricePerNight}</span> / night
        </div>
        <div className="card-rating-badge">
          <i className="fa-solid fa-star star-icon"></i> {lodging.rating}
        </div>
      </div>
      <div className="card-content">
        <div>
          <span className="card-location">{lodging.region}</span>
          <h4 className="card-title">{lodging.name}</h4>
        </div>
        
        {/* Bike Specific Specs */}
        <div className="card-specs">
          <div className="spec-item">
            <i className="fa-solid fa-warehouse"></i>
            <span>{lodging.bikepackSpecs.storageType}</span>
          </div>
          <div className="spec-item">
            <i className="fa-solid fa-screwdriver-wrench"></i>
            <span>{lodging.bikepackSpecs.toolKitBrand}</span>
          </div>
          <div className="spec-item">
            <i className="fa-solid fa-utensils"></i>
            <span>{lodging.bikepackSpecs.breakfastCalories} kcal high-carb meal</span>
          </div>
          <div className="spec-item" title={lodging.bikepackSpecs.accessNotes || 'No access details'}>
            <i className="fa-solid fa-route"></i>
            <span style={{ 
              color: 
                lodging.bikepackSpecs.rideInOut === 'Easy Gravel' ? 'var(--accent-lime)' : 
                lodging.bikepackSpecs.rideInOut === 'Steep Asphalt Climb' ? '#f59e0b' : 
                lodging.bikepackSpecs.rideInOut === 'Singletrack Trail' ? '#e11d48' : '#3b82f6',
              fontWeight: 600
            }}>
              {lodging.bikepackSpecs.rideInOut}
            </span>
          </div>
        </div>

        <div className="card-footer-info">
          <div className="host-info">
            <img src={lodging.hostAvatarUrl} alt={lodging.hostName} className="host-avatar" />
            <span className="host-name">{lodging.hostName}</span>
          </div>
          <span className="max-bikes">Max {lodging.maxBikes} rigs</span>
        </div>
      </div>
    </article>
  );
}

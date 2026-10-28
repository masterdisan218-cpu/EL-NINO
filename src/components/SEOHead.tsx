import React, { useEffect } from 'react';
import { useLanguage } from '../context/LanguageContext';

interface SEOHeadProps {
  titleEn: string;
  titleTe: string;
  titleEs?: string;
  descriptionEn: string;
  descriptionTe: string;
  descriptionEs?: string;
}

export const SEOHead: React.FC<SEOHeadProps> = ({
  titleEn,
  titleTe,
  titleEs,
  descriptionEn,
  descriptionTe,
  descriptionEs,
}) => {
  const { language, isTelugu, isSpanish } = useLanguage();

  useEffect(() => {
    let brandSuffix = 'El Niño Ready World';
    let title = titleEn;
    let description = descriptionEn;

    if (isTelugu) {
      brandSuffix = 'ఎల్ నినో రెడీ వరల్డ్';
      title = titleTe;
      description = descriptionTe;
    } else if (isSpanish) {
      brandSuffix = 'El Niño Ready World';
      title = titleEs || titleEn;
      description = descriptionEs || descriptionEn;
    }

    const fullTitle = `${title} | ${brandSuffix}`;
    document.title = fullTitle;

    // Update meta description
    let metaDesc = document.querySelector('meta[name="description"]');
    if (!metaDesc) {
      metaDesc = document.createElement('meta');
      metaDesc.setAttribute('name', 'description');
      document.head.appendChild(metaDesc);
    }
    metaDesc.setAttribute('content', description);

    // Update OpenGraph meta tags
    let ogTitle = document.querySelector('meta[property="og:title"]');
    if (ogTitle) {
      ogTitle.setAttribute('content', fullTitle);
    }
    let ogDesc = document.querySelector('meta[property="og:description"]');
    if (ogDesc) {
      ogDesc.setAttribute('content', description);
    }
  }, [language, isTelugu, isSpanish, titleEn, titleTe, titleEs, descriptionEn, descriptionTe, descriptionEs]);

  return null;
};

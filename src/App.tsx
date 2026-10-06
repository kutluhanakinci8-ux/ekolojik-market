import { Navigate, Route, Routes } from 'react-router-dom';
import { PosApp } from './PosApp';
import { LandingLayout } from './landing/LandingLayout';
import { LandingHome } from './landing/LandingHome';
import { LandingProducts } from './landing/LandingProducts';
import { LandingFeatures } from './landing/LandingFeatures';
import { LandingBlog } from './landing/LandingBlog';
import { LandingPricing } from './landing/LandingPricing';
import { LandingContact } from './landing/LandingContact';
import { LandingLogin } from './landing/LandingLogin';
import { LandingRegister } from './landing/LandingRegister';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingLayout />}>
        <Route index element={<LandingHome />} />
        <Route path="urunler" element={<LandingProducts />} />
        <Route path="ozellikler" element={<LandingFeatures />} />
        <Route path="blog" element={<LandingBlog />} />
        <Route path="fiyatlar" element={<LandingPricing />} />
        <Route path="iletisim" element={<LandingContact />} />
        <Route path="giris" element={<LandingLogin />} />
        <Route path="kayit" element={<LandingRegister />} />
      </Route>
      <Route path="/app" element={<PosApp />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

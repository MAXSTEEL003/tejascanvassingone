import React from 'react';
import { useNavigate } from 'react-router-dom';
import TejasExperience from '../components/TejasExperience';

export default function TejasExperienceView() {
  const navigate = useNavigate();

  return (
    <TejasExperience 
      onExploreStore={() => navigate('/store')} 
      onBack={() => navigate('/about')} 
    />
  );
}

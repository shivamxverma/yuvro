import './App.css';
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { LandingPage } from './components/landing';
import { CodingPage } from './components/codingPage';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/coding" element={<CodingPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;

import './App.css';
import { BrowserRouter, Route, Routes } from "react-router-dom";

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<div>Welcome to Yuvro</div>} />
      </Routes>
    </BrowserRouter>
  )
}

export default App;

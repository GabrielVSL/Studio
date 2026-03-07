import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import MovieDetails from './components/MovieDetails';
import Explorer from './components/Explorer'; // <-- IMPORT AQUI

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explorer" element={<Explorer />} /> {/* <-- NOVA ROTA AQUI */}
        <Route path="/detalhes/:id" element={<MovieDetails />} />
      </Routes>
    </Router>
  )
}

export default App;
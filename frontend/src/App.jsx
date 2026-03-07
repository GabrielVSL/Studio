import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Header from './components/Header';
import Home from './components/Home';
import MovieDetails from './components/MovieDetails';
import Explorer from './components/Explorer';
import MyList from './components/MyList';

function App() {
  return (
    <Router>
      <Header />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/explorer" element={<Explorer />} />
        <Route path="/detalhes/:id" element={<MovieDetails />} />
        <Route path="/minha-lista" element={<MyList />} />
      </Routes>
    </Router>
  )
}

export default App;
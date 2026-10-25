import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext.tsx'
import { CartProvider } from './context/CartContext.tsx'
import { SavedItemsProvider } from './context/SavedItemsContext.tsx'
import { ChatProvider } from './context/ChatContext.tsx'

import 'stream-chat-react/dist/css/index.css'
import 'leaflet/dist/leaflet.css'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
       <CartProvider>
        <SavedItemsProvider>
          <ChatProvider>
            <App />
          </ChatProvider>
        </SavedItemsProvider>
      </CartProvider>
      </AuthProvider>
      <Toaster position="top-center" />
    </BrowserRouter>
  </StrictMode>,
)






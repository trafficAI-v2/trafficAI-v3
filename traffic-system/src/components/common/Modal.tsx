// src/components/common/Modal.tsx

import React, { useEffect } from 'react';
import { BiX } from 'react-icons/bi';
import '../../styles/modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  // 新增：ESC 鍵關閉 modal 的功能
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey);
      // 防止背景頁面滾動
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen) {
    return null;
  }

  const handleOverlayClick = () => {
    onClose();
  };

  const handleOverlayKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div 
      className="modal-overlay" 
      onClick={handleOverlayClick}
      onKeyDown={handleOverlayKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      tabIndex={-1}
    >
      <div 
        className="modal-content" 
        onClick={(e) => e.stopPropagation()}
        role="document"
      >
        <div className="modal-header">
          <h3 id="modal-title" className="modal-title">{title}</h3>
          <button 
            className="modal-close-button" 
            onClick={onClose}
            aria-label="關閉對話框"
          >
            <BiX />
          </button>
        </div>

        {/* 【核心修改】將 children 用一個新的 .modal-body 包裹起來 */}
        <div className="modal-body">
          {children}
        </div>

        {/* 
          未來我們可以在這裡加入一個 .modal-footer 區塊，
          專門用來放「儲存」、「取消」等通用按鈕。
          目前暫時不需要。
        */}
      </div>
    </div>
  );
};

export default Modal;
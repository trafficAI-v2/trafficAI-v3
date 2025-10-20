// src/components/common/Modal.tsx

import React from 'react';
import { BiX } from 'react-icons/bi';
import '../../styles/modal.css';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

const Modal: React.FC<ModalProps> = ({ isOpen, onClose, title, children }) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{title}</h3>
          <button className="modal-close-button" onClick={onClose}>
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
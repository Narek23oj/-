
import React, { useState } from 'react';
import { StudentProfile, AVAILABLE_FRAMES, AVAILABLE_BACKGROUNDS } from '../types';
import { purchaseFrame, equipFrame, purchaseBackground, equipBackground } from '../services/storageService';
import Button from './Button';

interface StoreSectionProps {
  student: StudentProfile;
  onUpdate: (updatedStudent: StudentProfile) => void;
  onBack: () => void;
}

const StoreSection: React.FC<StoreSectionProps> = ({ student, onUpdate, onBack }) => {
  const [activeCategory, setActiveCategory] = useState<'FRAMES' | 'BACKGROUNDS'>('FRAMES');
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Safety checks: ensure arrays exist
  const frameInventory = student.inventory || [];
  const currentFrameId = student.equippedFrame;

  const bgInventory = student.inventoryBackgrounds || [];
  const currentBgId = student.equippedBackground;

  // --- FRAME HANDLERS ---
  const handlePurchaseFrame = async (frameId: string, price: number) => {
      setProcessingId(frameId);
      try {
          const updated = await purchaseFrame(student.id, frameId);
          if (updated) {
              onUpdate(updated);
              alert("Շնորհավորում ենք: Դուք գնեցիք նոր շրջանակ:");
          }
      } catch (e: any) {
          alert(e.message || "Purchase failed");
      } finally {
          setProcessingId(null);
      }
  };

  const handleEquipFrame = async (frameId: string) => {
      setProcessingId(frameId);
      try {
          // Toggle off if clicking the currently equipped one
          const newId = currentFrameId === frameId ? undefined : frameId;
          const updated = await equipFrame(student.id, newId);
          if (updated) onUpdate(updated);
      } catch (e) {
          console.error(e);
      } finally {
          setProcessingId(null);
      }
  };

  // --- BACKGROUND HANDLERS ---
  const handlePurchaseBackground = async (bgId: string, price: number) => {
      setProcessingId(bgId);
      try {
          const updated = await purchaseBackground(student.id, bgId);
          if (updated) {
              onUpdate(updated);
              alert("Շնորհավորում ենք: Դուք գնեցիք նոր ֆոն:");
          }
      } catch (e: any) {
          alert(e.message || "Purchase failed");
      } finally {
          setProcessingId(null);
      }
  };

  const handleEquipBackground = async (bgId: string) => {
      setProcessingId(bgId);
      try {
          const newId = currentBgId === bgId ? undefined : bgId;
          const updated = await equipBackground(student.id, newId);
          if (updated) onUpdate(updated);
      } catch (e) { console.error(e); } 
      finally { setProcessingId(null); }
  };

  return (
    <div className="bg-white rounded-xl shadow-lg border border-gray-200 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-6 text-white flex justify-between items-center shrink-0">
         <div>
             <h2 className="text-2xl font-bold flex items-center gap-2">
                 🛍️ Խանութ
             </h2>
             <p className="opacity-90 text-sm mt-1">Ծախսիր քո միավորները և զարդարիր քո էջը</p>
         </div>
         <div className="flex flex-col items-end">
             <div className="bg-white/20 px-4 py-2 rounded-lg backdrop-blur-sm border border-white/30 text-center">
                 <span className="block text-xs uppercase opacity-80">Քո հաշիվը</span>
                 <span className="text-xl font-bold text-yellow-300 drop-shadow-sm">{student.score || 0} ★</span>
             </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50/50">
          <div className="flex justify-between items-center mb-6">
              <Button variant="ghost" onClick={onBack} className="text-gray-500 hover:text-gray-800">
                 ← Վերադառնալ
              </Button>

              {/* Category Toggles */}
              <div className="flex bg-gray-200 p-1 rounded-lg">
                  <button 
                    onClick={() => setActiveCategory('FRAMES')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeCategory === 'FRAMES' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      Շրջանակներ
                  </button>
                  <button 
                    onClick={() => setActiveCategory('BACKGROUNDS')}
                    className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${activeCategory === 'BACKGROUNDS' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                      Ֆոներ
                  </button>
              </div>
          </div>

          {activeCategory === 'FRAMES' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                  {AVAILABLE_FRAMES.map(frame => {
                      const isOwned = frameInventory.includes(frame.id);
                      const isEquipped = currentFrameId === frame.id;
                      const canAfford = (student.score || 0) >= frame.price;
                      const isGradientBg = frame.styleClass.includes('bg-gradient');
                      
                      return (
                          <div 
                            key={frame.id} 
                            className={`relative rounded-xl border-2 transition-all duration-200 overflow-hidden flex flex-col
                                ${isEquipped ? 'border-primary shadow-lg scale-[1.02] bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md bg-white'}
                            `}
                          >
                              {/* Preview Area */}
                              <div 
                                className="h-32 flex items-center justify-center relative"
                                style={{ backgroundColor: frame.previewColor }}
                              >
                                  <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${isGradientBg ? frame.styleClass : ''}`}>
                                      <div className={`w-full h-full rounded-full bg-gray-300 overflow-hidden ${!isGradientBg ? frame.styleClass : 'border-2 border-white'}`}>
                                          <img 
                                            src={student.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${student.name}`} 
                                            className="w-full h-full object-cover" 
                                          />
                                      </div>
                                  </div>
                                  {isOwned && <div className="absolute top-2 right-2 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200">OWNED</div>}
                              </div>

                              <div className="p-4 flex flex-col flex-1">
                                  <div className="flex justify-between items-start mb-2">
                                      <h3 className="font-bold text-gray-800">{frame.name}</h3>
                                      <span className={`text-xs font-bold px-2 py-1 rounded ${isOwned ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-800'}`}>
                                          {frame.price} ★
                                      </span>
                                  </div>
                                  <div className="mt-auto pt-3">
                                      {isOwned ? (
                                          <Button 
                                            onClick={() => handleEquipFrame(frame.id)} 
                                            isLoading={processingId === frame.id}
                                            variant={isEquipped ? 'secondary' : 'primary'}
                                            className={`w-full text-sm ${isEquipped ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                          >
                                              {isEquipped ? '✓ Հագած է' : 'Հագնել'}
                                          </Button>
                                      ) : (
                                          <Button 
                                            onClick={() => handlePurchaseFrame(frame.id, frame.price)}
                                            isLoading={processingId === frame.id}
                                            disabled={!canAfford}
                                            className={`w-full text-sm ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}`}
                                          >
                                              {canAfford ? 'Գնել' : 'Բալերը չեն հերիքում'}
                                          </Button>
                                      )}
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          )}

          {activeCategory === 'BACKGROUNDS' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 animate-fade-in">
                  {AVAILABLE_BACKGROUNDS.map(bg => {
                      const isOwned = bgInventory.includes(bg.id);
                      const isEquipped = currentBgId === bg.id;
                      const canAfford = (student.score || 0) >= bg.price;
                      
                      return (
                          <div 
                            key={bg.id} 
                            className={`relative rounded-xl border-2 transition-all duration-200 overflow-hidden flex flex-col
                                ${isEquipped ? 'border-primary shadow-lg scale-[1.02]' : 'border-gray-200 hover:border-indigo-300 hover:shadow-md bg-white'}
                            `}
                          >
                              {/* Preview Area - Mini Chat */}
                              <div 
                                className="h-32 p-3 flex flex-col justify-end gap-2 relative overflow-hidden"
                                style={{ background: bg.cssValue }}
                              >
                                  <div className="self-start bg-white/90 backdrop-blur-sm p-1.5 rounded-lg rounded-bl-none text-[10px] shadow-sm max-w-[80%] border border-gray-100">
                                      Hello! Do you like this background?
                                  </div>
                                  <div className="self-end bg-primary/90 text-white p-1.5 rounded-lg rounded-br-none text-[10px] shadow-sm max-w-[80%]">
                                      Yes, it looks amazing!
                                  </div>

                                  {isOwned && <div className="absolute top-2 right-2 bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-green-200 shadow-sm z-10">OWNED</div>}
                              </div>

                              <div className="p-4 flex flex-col flex-1 bg-white">
                                  <div className="flex justify-between items-start mb-2">
                                      <h3 className="font-bold text-gray-800">{bg.name}</h3>
                                      <span className={`text-xs font-bold px-2 py-1 rounded ${isOwned ? 'bg-gray-100 text-gray-500' : 'bg-yellow-100 text-yellow-800'}`}>
                                          {bg.price} ★
                                      </span>
                                  </div>
                                  
                                  <div className="mt-auto pt-3">
                                      {isOwned ? (
                                          <Button 
                                            onClick={() => handleEquipBackground(bg.id)} 
                                            isLoading={processingId === bg.id}
                                            variant={isEquipped ? 'secondary' : 'primary'}
                                            className={`w-full text-sm ${isEquipped ? 'bg-green-600 hover:bg-green-700' : ''}`}
                                          >
                                              {isEquipped ? '✓ Ընտրված է' : 'Ընտրել'}
                                          </Button>
                                      ) : (
                                          <Button 
                                            onClick={() => handlePurchaseBackground(bg.id, bg.price)}
                                            isLoading={processingId === bg.id}
                                            disabled={!canAfford}
                                            className={`w-full text-sm ${!canAfford ? 'opacity-50 cursor-not-allowed' : ''}`}
                                          >
                                              {canAfford ? 'Գնել' : 'Բալերը չեն հերիքում'}
                                          </Button>
                                      )}
                                  </div>
                              </div>
                          </div>
                      )
                  })}
              </div>
          )}
      </div>
    </div>
  );
};

export default StoreSection;

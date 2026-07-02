import React, { useState } from 'react';

export default function StripePaymentCheckout() {
  const [amount, setAmount] = useState(5);
  const [donorName, setDonorName] = useState('');
  const [donorMessage, setDonorMessage] = useState('');
  const [paymentStatus, setPaymentStatus] = useState('idle'); // idle | loading | qr_generated | success

  const PRESETS = [
    { value: 5, label: '🍺 5€ - Birra Fredda' },
    { value: 10, label: '🍟 10€ - Patatine & Snack' },
    { value: 20, label: '🎸 20€ - Sostenitore Jam' },
  ];

  const handlePresetSelect = (val) => {
    setAmount(val);
  };

  const handleStartCheckout = (e) => {
    e.preventDefault();
    setPaymentStatus('loading');
    setTimeout(() => {
      setPaymentStatus('qr_generated');
    }, 1200);
  };

  const simulateSuccess = () => {
    setPaymentStatus('loading');
    setTimeout(() => {
      setPaymentStatus('success');
    }, 1500);
  };

  const resetForm = () => {
    setAmount(5);
    setDonorName('');
    setDonorMessage('');
    setPaymentStatus('idle');
  };

  return (
    <div style={{
      border: '3px solid var(--white)',
      padding: '24px',
      backgroundColor: '#000000',
      color: 'var(--white)',
      marginTop: '10px'
    }}>
      <div style={{ borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '12px', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '1.4rem', textTransform: 'uppercase' }}>Sostieni la Jam 🌊</h2>
        <p style={{ fontSize: '0.85rem', color: 'var(--charcoal)', marginTop: '4px' }}>
          Aiutaci a coprire i costi dell'attrezzatura e del falò. Paga in sicurezza con Stripe o scansiona il QR Code.
        </p>
      </div>

      {paymentStatus === 'idle' && (
        <form onSubmit={handleStartCheckout} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label className="bauhaus-label">Scegli quanto donare</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
              {PRESETS.map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => handlePresetSelect(preset.value)}
                  style={{
                    flex: '1 1 auto',
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: '900',
                    border: '1px solid var(--white)',
                    backgroundColor: amount === preset.value ? 'var(--bauhaus-yellow)' : 'transparent',
                    color: amount === preset.value ? 'black' : 'white',
                    cursor: 'pointer',
                    textTransform: 'uppercase'
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <input
              type="number"
              min="1"
              value={amount}
              onChange={(e) => setAmount(Number(e.target.value))}
              className="bauhaus-input"
              style={{ fontSize: '1.1rem', fontWeight: 'bold' }}
              placeholder="Importo Personalizzato (€)"
              required
            />
          </div>

          <div>
            <label className="bauhaus-label">Tuo Nome / Pseudonimo</label>
            <input
              type="text"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
              className="bauhaus-input"
              placeholder="ES. COWBOY SOLITARIO"
            />
          </div>

          <div>
            <label className="bauhaus-label">Messaggio per la Band</label>
            <input
              type="text"
              value={donorMessage}
              onChange={(e) => setDonorMessage(e.target.value)}
              className="bauhaus-input"
              placeholder="ES. SUONATE LA CANZONE DEL SOLE!"
            />
          </div>

          <button type="submit" className="btn-bauhaus btn-blue" style={{ marginTop: '8px' }}>
            Genera QR Code di Pagamento →
          </button>
        </form>
      )}

      {paymentStatus === 'loading' && (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div style={{
            display: 'inline-block',
            width: '40px',
            height: '40px',
            border: '4px solid var(--bauhaus-yellow)',
            borderTopColor: 'transparent',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          <p style={{ fontWeight: 'bold', textTransform: 'uppercase' }}>Elaborazione in corso...</p>
        </div>
      )}

      {paymentStatus === 'qr_generated' && (
        <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{
            backgroundColor: 'var(--white)',
            padding: '16px',
            border: '4px solid var(--bauhaus-blue)',
            display: 'inline-block'
          }}>
            {/* Bauhaus-styled Mock QR Code representation */}
            <div style={{ width: '160px', height: '160px', backgroundColor: '#fff', display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {Array.from({ length: 64 }).map((_, i) => (
                <div key={i} style={{
                  width: '16px',
                  height: '16px',
                  backgroundColor: (i * 3 + amount) % 2 === 0 ? 'black' : 'white'
                }} />
              ))}
            </div>
          </div>

          <div>
            <h3 style={{ fontSize: '1.2rem', color: 'var(--bauhaus-yellow)' }}>DONAZIONE DA {amount}€</h3>
            <p style={{ fontSize: '0.85rem', marginTop: '4px' }}>
              Scansiona il codice QR con la fotocamera del telefono per completare la transazione sicura tramite Stripe.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
            <button onClick={resetForm} className="btn-bauhaus btn-red" style={{ flex: 1 }}>
              Annulla
            </button>
            <button onClick={simulateSuccess} className="btn-bauhaus btn-blue" style={{ flex: 1 }}>
              Simula Successo [DEV]
            </button>
          </div>
        </div>
      )}

      {paymentStatus === 'success' && (
        <div style={{ textAlign: 'center', padding: '24px 0' }}>
          <div style={{
            backgroundColor: 'var(--bauhaus-yellow)',
            color: 'var(--black)',
            padding: '16px',
            fontWeight: '900',
            fontSize: '1.2rem',
            textTransform: 'uppercase',
            marginBottom: '20px',
            border: '2px solid var(--white)'
          }}>
            🎉 GRAZIE MILLE PER IL TUO SUPPORTO!
          </div>

          <p style={{ marginBottom: '24px' }}>
            La tua donazione di <strong>{amount}€</strong> è stata registrata con successo.
            {donorName && <span> A nome di <strong>{donorName}</strong>.</span>}
          </p>

          <button onClick={resetForm} className="btn-bauhaus">
            Fai un'altra donazione
          </button>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Circle } from 'react-leaflet';
import { MarkerClusterGroup } from 'react-leaflet-markercluster';
import io from 'socket.io-client';
import Chart from 'chart.js/auto';

const socket = io('http://localhost:3000');

function App() {
  const [entregadores, setEntregadores] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState({ ativos: 0, inativos: 0 });
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredEntregadores, setFilteredEntregadores] = useState([]);

  useEffect(() => {
    fetch('http://localhost:3000/entregadores', {
      headers: {
        Authorization: 'Bearer seu-token-aqui', // Substitua pelo token JWT.
      },
    })
      .then((res) => res.json())
      .then((data) => {
        setEntregadores(data);
        setMetrics({
          ativos: data.filter((d) => d.status === 'Ativo').length,
          inativos: data.filter((d) => d.status === 'Inativo').length,
        });
        setFilteredEntregadores(data);
      });

    socket.on('locationUpdated', ({ id, localizacaoAtual }) => {
      setEntregadores((prevState) =>
        prevState.map((entregador) =>
          entregador._id === id ? { ...entregador, localizacaoAtual } : entregador
        )
      );
    });

    socket.on('geofenceAlert', (alert) => {
      setAlerts((prev) => [...prev, alert.message]);
    });
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    setFilteredEntregadores(
      entregadores.filter((entregador) =>
        entregador.nome.toLowerCase().includes(query.toLowerCase())
      )
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Header */}
      <div style={{ padding: '10px', backgroundColor: '#3f51b5', color: 'white' }}>
        <h1>Gestão de Entregadores</h1>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Buscar entregadores..."
          style={{
            padding: '5px',
            width: '300px',
            borderRadius: '5px',
            border: 'none',
            marginTop: '10px',
          }}
        />
      </div>

      <div style={{ flex: 1, display: 'flex' }}>
        {/* Mapa */}
        <div style={{ width: '70%', height: '100%' }}>
          <MapContainer center={[-23.5505, -46.6333]} zoom={12} style={{ height: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
            <MarkerClusterGroup>
              {filteredEntregadores.map((entregador) => (
                <React.Fragment key={entregador._id}>
                  <Marker position={[entregador.localizacaoAtual.lat, entregador.localizacaoAtual.lng]} />
                  <Polyline positions={entregador.rota.map((point) => [point.lat, point.lng])} />
                  {entregador.geofence && (
                    <Circle
                      center={[entregador.geofence.lat, entregador.geofence.lng]}
                      radius={entregador.geofence.radius * 1000}
                      color="red"
                    />
                  )}
                </React.Fragment>
              ))}
            </MarkerClusterGroup>
          </MapContainer>
        </div>

        {/* Painel lateral */}
        <div style={{ width: '30%', padding: '10px', backgroundColor: '#f5f5f5' }}>
          <h4>Métricas</h4>
          <canvas id="chart"></canvas>
          <script>
            {new Chart(document.getElementById('chart'), {
              type: 'pie',
              data: {
                labels: ['Ativos', 'Inativos'],
                datasets: [
                  {
                    data: [metrics.ativos, metrics.inativos],
                    backgroundColor: ['green', 'gray'],
                  },
                ],
              },
            })}
          </script>
          <h4>Notificações</h4>
          {alerts.map((alert, index) => (
            <p key={index}>{alert}</p>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;

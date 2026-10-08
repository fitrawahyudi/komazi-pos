import { useEffect, useState, useCallback, useRef } from 'react';
import { getSocket, joinStationRoom, leaveStationRoom } from '../services/socket';

/**
 * Hook untuk menghubungkan komponen KDS / BDS ke Socket.IO room station
 * Mendukung auto-reconnect, status koneksi realtime, dan listener event.
 */
export function useKdsSocket({ stationCode, onOrderNew, onOrderItemUpdated, onOrderUpdated, onReconnect }) {
  const [isConnected, setIsConnected] = useState(false);
  const callbacksRef = useRef({ onOrderNew, onOrderItemUpdated, onOrderUpdated, onReconnect });

  useEffect(() => {
    callbacksRef.current = { onOrderNew, onOrderItemUpdated, onOrderUpdated, onReconnect };
  }, [onOrderNew, onOrderItemUpdated, onOrderUpdated, onReconnect]);

  useEffect(() => {
    const socket = getSocket();

    const handleConnect = () => {
      setIsConnected(true);
      if (stationCode && stationCode !== 'ALL') {
        joinStationRoom(stationCode);
      }
      if (callbacksRef.current.onReconnect) {
        callbacksRef.current.onReconnect();
      }
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handleNewOrder = (data) => {
      if (callbacksRef.current.onOrderNew) {
        callbacksRef.current.onOrderNew(data);
      }
    };

    const handleItemUpdated = (data) => {
      if (callbacksRef.current.onOrderItemUpdated) {
        callbacksRef.current.onOrderItemUpdated(data);
      }
    };

    const handleOrderUpdated = (data) => {
      if (callbacksRef.current.onOrderUpdated) {
        callbacksRef.current.onOrderUpdated(data);
      }
    };

    // Check initial state
    setIsConnected(socket.connected);
    if (socket.connected && stationCode && stationCode !== 'ALL') {
      joinStationRoom(stationCode);
    }

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('order:new', handleNewOrder);
    socket.on('order:item:updated', handleItemUpdated);
    socket.on('order:updated', handleOrderUpdated);

    return () => {
      if (stationCode && stationCode !== 'ALL') {
        leaveStationRoom(stationCode);
      }
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('order:new', handleNewOrder);
      socket.off('order:item:updated', handleItemUpdated);
      socket.off('order:updated', handleOrderUpdated);
    };
  }, [stationCode]);

  return { isConnected };
}

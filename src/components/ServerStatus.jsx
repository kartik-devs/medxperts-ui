import { useState, useEffect } from 'react';
import { testAPIConnection } from '../contexts/search-case';
import { Wifi, WifiOff, RefreshCw } from 'lucide-react';

const ServerStatus = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState(null);

  const checkConnection = async () => {
    setIsChecking(true);
    try {
      const connected = await testAPIConnection();
      setIsConnected(connected);
      setLastChecked(new Date());
    } catch (error) {
      setIsConnected(false);
    } finally {
      setIsChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
    // Check every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
      isConnected 
        ? 'bg-green-100 text-green-700' 
        : 'bg-red-100 text-red-700'
    }`}>
      {isChecking ? (
        <RefreshCw className="w-3 h-3 animate-spin" />
      ) : isConnected ? (
        <Wifi className="w-3 h-3" />
      ) : (
        <WifiOff className="w-3 h-3" />
      )}
      
      <span className="font-medium">
        {isChecking ? 'Checking...' : isConnected ? 'Server Online' : 'Server Offline'}
      </span>
      
      {lastChecked && (
        <span className="text-xs opacity-75">
          {lastChecked.toLocaleTimeString()}
        </span>
      )}
      
      {!isConnected && (
        <button
          onClick={checkConnection}
          className="ml-1 px-2 py-0.5 bg-red-200 hover:bg-red-300 rounded text-xs"
          disabled={isChecking}
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default ServerStatus;
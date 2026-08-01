import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { toast } from "react-toastify";
import { useAuth } from "./AuthContext";

const SocketContext = createContext({ socket: null, connected: false });

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!user) {
      setSocket(null);
      setConnected(false);
      return undefined;
    }

    const instance = io(process.env.REACT_APP_SOCKET_URL || window.location.origin, {
      path: "/socket.io",
      withCredentials: true,
      transports: ["websocket", "polling"],
      timeout: 10000
    });

    instance.on("connect", () => setConnected(true));
    instance.on("disconnect", () => setConnected(false));
    instance.on("notification:new", (notification) => {
      toast.info(notification.title, { toastId: notification._id });
      window.dispatchEvent(new CustomEvent("legalsphere:notification", { detail: notification }));
    });
    instance.on("account:updated", () => {
      window.dispatchEvent(new CustomEvent("legalsphere:account-updated"));
    });
    instance.on("connect_error", () => setConnected(false));

    setSocket(instance);
    return () => {
      instance.removeAllListeners();
      instance.close();
    };
  }, [user]);

  const value = useMemo(() => ({ socket, connected }), [socket, connected]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  return useContext(SocketContext);
}

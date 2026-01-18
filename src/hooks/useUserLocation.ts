import * as Location from "expo-location";
import { useEffect, useState } from "react";

export type UserLocation = {
  latitude: number;
  longitude: number;
};

export function useUserLocation() {
  const [location, setLocation] = useState<UserLocation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { status } =
        await Location.requestForegroundPermissionsAsync();

      if (status !== "granted") {
        setError("Location permission denied");
        setLoading(false);
        return;
      }

      const currentLocation =
        await Location.getCurrentPositionAsync({});

      setLocation({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude
      });

      setLoading(false);
    })();
  }, []);

  return { location, error, loading };
}

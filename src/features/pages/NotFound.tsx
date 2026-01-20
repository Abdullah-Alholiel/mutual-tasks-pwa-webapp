import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import ResourceNotFound from "@/components/ui/ResourceNotFound";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  return (
    <ResourceNotFound
      type="page"
      status="not_found"
      onBack={() => navigate(-1)}
      onAction={() => navigate('/')}
    />
  );
};

export default NotFound;

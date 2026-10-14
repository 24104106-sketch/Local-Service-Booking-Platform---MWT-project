import { useContext, useMemo, useCallback } from "react";
import { ServiceContext } from "../context/ServiceContext";
import { useToast } from "./useToast";

/**
 * Custom hook — unified interface for services and categories.
 */
export function useServices() {
  const context = useContext(ServiceContext);
  if (!context) {
    throw new Error("useServices must be used within a ServiceProvider");
  }

  const {
    services,
    categories,
    hydrated,
    addService: addServiceDirect,
    updateService: updateServiceDirect,
    deleteService: deleteServiceDirect,
    toggleServiceStatus: toggleServiceStatusDirect,
    addCategory: addCategoryDirect,
    deleteCategory: deleteCategoryDirect,
  } = context;

  const { showToast } = useToast();

  const activeServices = useMemo(() => services.filter((s) => s.status === "Active"), [services]);

  const servicesByProvider = useCallback(
    (providerName) => services.filter((s) => s.provider === providerName),
    [services]
  );

  const activeServicesByProvider = useCallback(
    (providerName) => services.filter((s) => s.provider === providerName && s.status === "Active"),
    [services]
  );

  const getServiceById = useCallback(
    (id) => services.find((s) => String(s.id) === String(id)),
    [services]
  );

  const addService = useCallback(
    (serviceData) => {
      const created = addServiceDirect(serviceData);
      showToast(`Service "${created.name}" added!`, "success");
      return created;
    },
    [addServiceDirect, showToast]
  );

  const updateService = useCallback(
    (id, updates) => {
      updateServiceDirect(id, updates);
      showToast("Service updated successfully", "success");
    },
    [updateServiceDirect, showToast]
  );

  const deleteService = useCallback(
    (id) => {
      deleteServiceDirect(id);
      showToast("Service deleted", "info");
    },
    [deleteServiceDirect, showToast]
  );

  const toggleServiceStatus = useCallback(
    (id) => {
      const item = services.find((s) => s.id === id);
      toggleServiceStatusDirect(id);
      const nextStatus = item?.status === "Active" ? "Inactive" : "Active";
      showToast(`Service status updated to ${nextStatus}`, "info");
    },
    [services, toggleServiceStatusDirect, showToast]
  );

  const addCategory = useCallback(
    (name, description) => {
      const cat = addCategoryDirect(name, description);
      if (cat) showToast(`Category "${cat.name}" added`, "success");
      return cat;
    },
    [addCategoryDirect, showToast]
  );

  const deleteCategory = useCallback(
    (id) => {
      deleteCategoryDirect(id);
      showToast("Category deleted", "info");
    },
    [deleteCategoryDirect, showToast]
  );

  return {
    services,
    activeServices,
    categories,
    loading: !hydrated,
    servicesByProvider,
    activeServicesByProvider,
    getServiceById,
    addService,
    updateService,
    deleteService,
    toggleServiceStatus,
    addCategory,
    deleteCategory,
  };
}

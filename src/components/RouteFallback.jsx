import Skeleton from "./Skeleton";

function RouteFallback() {
  return (
    <div style={{ padding: "40px 32px", maxWidth: 900, margin: "0 auto" }}>
      <Skeleton variant="card" count={4} />
      <div style={{ marginTop: 24 }}>
        <Skeleton variant="table" count={4} />
      </div>
    </div>
  );
}

export default RouteFallback;

import { DetailDrawer } from "../DetailDrawer";

export function AIDetectionDetail({ onClose }: { onClose: () => void }) {
  return (
    <DetailDrawer onClose={onClose}>
      {() => (
        <div className="flex h-full items-center justify-center text-[13px]">
          AI detection detail
        </div>
      )}
    </DetailDrawer>
  );
}

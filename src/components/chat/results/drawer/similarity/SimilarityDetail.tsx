import { DetailDrawer } from "../DetailDrawer";

export function SimilarityDetail({ onClose }: { onClose: () => void }) {
  return (
    <DetailDrawer onClose={onClose}>
      {() => (
        <div className="flex h-full items-center justify-center text-[13px]">
          Similarity detail
        </div>
      )}
    </DetailDrawer>
  );
}

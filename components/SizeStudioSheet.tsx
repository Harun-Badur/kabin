import SizeStudioCard from './SizeStudioCard';
import ProfileSheet from './ProfileSheet';
import type {
  GarmentSize,
  StyleTag,
  UserStudioProfile,
} from '../types/profile';

interface SizeStudioSheetProps {
  visible: boolean;
  profile: UserStudioProfile;
  disabled: boolean;
  onClose: () => void;
  onHeightChange: (value: number) => void;
  onWeightChange: (value: number) => void;
  onTopSizeChange: (value: GarmentSize) => void;
  onBottomSizeChange: (value: GarmentSize) => void;
  onStyleToggle: (value: StyleTag) => void;
}

export default function SizeStudioSheet({
  visible,
  profile,
  disabled,
  onClose,
  onHeightChange,
  onWeightChange,
  onTopSizeChange,
  onBottomSizeChange,
  onStyleToggle,
}: SizeStudioSheetProps) {
  return (
    <ProfileSheet
      visible={visible}
      title="Beden & stil tercihlerim"
      onClose={onClose}
    >
      <SizeStudioCard
        profile={profile}
        disabled={disabled}
        onHeightChange={onHeightChange}
        onWeightChange={onWeightChange}
        onTopSizeChange={onTopSizeChange}
        onBottomSizeChange={onBottomSizeChange}
        onStyleToggle={onStyleToggle}
      />
    </ProfileSheet>
  );
}

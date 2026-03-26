import type { AssetRef } from './refs';

export interface StoredAssetMetadata extends AssetRef {}

export interface AssetStoragePort {
  registerAsset(asset: StoredAssetMetadata): Promise<StoredAssetMetadata>;
  resolveAsset(assetRef: AssetRef): Promise<StoredAssetMetadata | null>;
}

import type { TransferSpaceCheck } from "../hooks/tauriCommands/fileCommands";
import {
  useTransferSpaceWarningStore,
  type TransferSpaceShortage,
} from "../store/transferSpaceWarningStore";

export interface TransferSpaceClient {
  checkTransferSpace?: (
    sourcePaths: string[],
    targetPath: string,
    isMove: boolean
  ) => Promise<TransferSpaceCheck>;
}

/**
 * 대상 볼륨의 공간이 부족하다고 확인되면 부족 정보를, 아니면 null을 돌려준다.
 * 경고용이라 확인 중 오류가 나거나 남은 공간을 모르면 null(진행)로 본다.
 */
export const findTransferSpaceShortage = async (
  client: TransferSpaceClient,
  sourcePaths: string[],
  targetPath: string,
  isMove: boolean
): Promise<TransferSpaceShortage | null> => {
  if (!client.checkTransferSpace || sourcePaths.length === 0) {
    return null;
  }

  try {
    const check = await client.checkTransferSpace(sourcePaths, targetPath, isMove);
    if (!check.insufficient || check.availableBytes === null) {
      return null;
    }

    return {
      isMove,
      requiredBytes: check.requiredBytes,
      availableBytes: check.availableBytes,
      complete: check.complete,
    };
  } catch (error) {
    console.warn("Failed to check available space before transfer:", error);
    return null;
  }
};

/**
 * 공간이 부족하면 경고를 띄워 사용자에게 묻는다. 진행해도 되면 true.
 * 막지 않고 경고만 한다(선택은 사용자에게 맡긴다).
 */
export const confirmTransferSpace = async (
  client: TransferSpaceClient,
  sourcePaths: string[],
  targetPath: string,
  isMove: boolean
): Promise<boolean> => {
  const shortage = await findTransferSpaceShortage(
    client,
    sourcePaths,
    targetPath,
    isMove
  );
  if (!shortage) {
    return true;
  }

  return useTransferSpaceWarningStore.getState().requestConfirmation(shortage);
};

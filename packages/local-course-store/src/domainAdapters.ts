import * as fs from 'fs/promises';
import * as path from 'path';
import type {
  AssetStoragePort,
  Course as DomainCourse,
  CourseMaterial,
  StoredAssetMetadata,
} from '@hg/domain-workflow';
import { getCourse, getDataDirOnce } from './fileCourseStore';
import { getLecture, listLectures } from './fileLectureStore';

const toStoredAssetMetadata = async (
  assetId: string,
  logicalBucket: string,
  absolutePath: string
): Promise<StoredAssetMetadata> => {
  const stats = await fs.stat(absolutePath);

  return {
    assetId,
    storageKind: 'local_file',
    logicalBucket,
    path: absolutePath,
    sizeBytes: stats.size,
    originalName: path.basename(absolutePath),
  };
};

export const toDomainCourse = async (courseId: string): Promise<DomainCourse> => {
  const course = await getCourse(courseId);

  return {
    courseId: course.courseId,
    title: course.title,
    status: 'active',
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
};

export const listCourseMaterialsFromLectures = async (
  courseId: string
): Promise<CourseMaterial[]> => {
  const lectures = await listLectures(courseId);

  return lectures.map((lecture) => ({
    materialId: `lecture:${lecture.lectureId}`,
    courseId: lecture.courseId,
    kind: 'lecture_asset',
    assetRef: {
      assetId: `lecture:${lecture.lectureId}`,
      storageKind: 'local_file',
      logicalBucket: 'course_lecture_assets',
      path: lecture.assetPath,
      originalName: path.basename(lecture.assetPath),
    },
    title: lecture.title,
    createdAt: lecture.createdAt,
    updatedAt: lecture.updatedAt,
  }));
};

export const getCourseMaterialFromLecture = async (
  courseId: string,
  lectureId: string
): Promise<CourseMaterial> => {
  const lecture = await getLecture(courseId, lectureId);

  return {
    materialId: `lecture:${lecture.lectureId}`,
    courseId: lecture.courseId,
    kind: 'lecture_asset',
    assetRef: {
      assetId: `lecture:${lecture.lectureId}`,
      storageKind: 'local_file',
      logicalBucket: 'course_lecture_assets',
      path: lecture.assetPath,
      originalName: path.basename(lecture.assetPath),
    },
    title: lecture.title,
    createdAt: lecture.createdAt,
    updatedAt: lecture.updatedAt,
  };
};

export const createLocalCourseAssetStorageAdapter = (): AssetStoragePort => ({
  async registerAsset(asset) {
    return asset;
  },
  async resolveAsset(assetRef) {
    try {
      const dataDir = getDataDirOnce();
      const absolutePath = path.isAbsolute(assetRef.path)
        ? assetRef.path
        : path.join(dataDir, assetRef.path);

      return await toStoredAssetMetadata(assetRef.assetId, assetRef.logicalBucket, absolutePath);
    } catch (error) {
      return null;
    }
  },
});

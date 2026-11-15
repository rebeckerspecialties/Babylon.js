uniform<Material> vAlbedoInfos: vec2f;
uniform<Material> vBaseWeightInfos: vec2f;
uniform<Material> vBaseDiffuseRoughnessInfos: vec2f;
uniform<Material> vAmbientInfos: vec4f;
uniform<Material> vBentNormalInfos: vec2f;
uniform<Material> vOpacityInfos: vec2f;
uniform<Material> vEmissiveInfos: vec2f;
uniform<Material> vLightmapInfos: vec2f;
uniform<Material> vReflectivityInfos: vec3f;
uniform<Material> vMicroSurfaceSamplerInfos: vec2f;
uniform<Material> vBumpInfos: vec3f;
uniform<Material> albedoMatrix: mat4x4f;
uniform<Material> baseWeightMatrix: mat4x4f;
uniform<Material> baseDiffuseRoughnessMatrix: mat4x4f;
uniform<Material> ambientMatrix: mat4x4f;
uniform<Material> bentNormalMatrix: mat4x4f;
uniform<Material> opacityMatrix: mat4x4f;
uniform<Material> emissiveMatrix: mat4x4f;
uniform<Material> lightmapMatrix: mat4x4f;
uniform<Material> reflectivityMatrix: mat4x4f;
uniform<Material> microSurfaceSamplerMatrix: mat4x4f;
uniform<Material> bumpMatrix: mat4x4f;
uniform<Material> vTangentSpaceParams: vec2f;
uniform<Material> vAlbedoColor: vec4f;
uniform<Material> baseWeight: f32;
uniform<Material> baseDiffuseRoughness: f32;
uniform<Material> vLightingIntensity: vec4f;
uniform<Material> pointSize: f32;
uniform<Material> vReflectivityColor: vec4f;
uniform<Material> vEmissiveColor: vec3f;
uniform<Material> vAmbientColor: vec3f;

uniform<Material> vDebugMode: vec2f;

uniform<Material> vMetallicReflectanceFactors: vec4f;
uniform<Material> vMetallicReflectanceInfos: vec2f;
uniform<Material> metallicReflectanceMatrix: mat4x4f;
uniform<Material> vReflectanceInfos: vec2f;
uniform<Material> reflectanceMatrix: mat4x4f;
uniform<Material> cameraInfo: vec4f;
uniform<Material> vTextureRepetitionHexTilingParams: vec4f;

uniform<Material> vReflectionInfos: vec2f;
uniform<Material> reflectionMatrix: mat4x4f;
uniform<Material> vReflectionMicrosurfaceInfos: vec3f;
uniform<Material> vReflectionPosition: vec3f;
uniform<Material> vReflectionSize: vec3f;
uniform<Material> vReflectionFilteringInfo: vec2f;
uniform<Material> vReflectionDominantDirection: vec3f;
uniform<Material> vReflectionColor: vec3f;

uniform<Material> vSphericalL00: vec3f;
uniform<Material> vSphericalL1_1: vec3f;
uniform<Material> vSphericalL10: vec3f;
uniform<Material> vSphericalL11: vec3f;
uniform<Material> vSphericalL2_2: vec3f;
uniform<Material> vSphericalL2_1: vec3f;
uniform<Material> vSphericalL20: vec3f;
uniform<Material> vSphericalL21: vec3f;
uniform<Material> vSphericalL22: vec3f;

uniform<Material> vSphericalX: vec3f;
uniform<Material> vSphericalY: vec3f;
uniform<Material> vSphericalZ: vec3f;
uniform<Material> vSphericalXX_ZZ: vec3f;
uniform<Material> vSphericalYY_ZZ: vec3f;
uniform<Material> vSphericalZZ: vec3f;
uniform<Material> vSphericalXY: vec3f;
uniform<Material> vSphericalYZ: vec3f;
uniform<Material> vSphericalZX: vec3f;

#define ADDITIONAL_UBO_DECLARATION


#include<sceneUboDeclaration>
#include<meshUboDeclaration>

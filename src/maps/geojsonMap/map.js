/*
 * @Author: wdy
 * @Date: 2023-06-27 14:39:23
 * @Last Modified by: wdy
 * @Last Modified time: 2023-08-14 10:47:36
 */
import * as d3 from 'd3-geo';
import * as THREE from 'three';
import * as turf from '@turf/turf';
import TWEEN from '@tweenjs/tween.js';
import { cloneDeep, flattenDepth, get } from 'lodash';
import { PlaneGeometry } from 'three/src/geometries/PlaneGeometry';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer';
import { CSS3DSprite, CSS3DRenderer } from 'three/examples/jsm/renderers/CSS3DRenderer';
// apis
// hooks
// utils
// stores
// mixins
// configs
// components
import GROUND_TEXTURE from './assets/image/ground-bg.png';
import AREA_TEXTURE from './assets/image/mesh-bg3.png';

const defaultThemes = {
  ground: {
    texture: {
      source: GROUND_TEXTURE,
      size: [1000, 1000, 1, 1], // 地面的尺寸
      opacity: 1
    }
  },
  // 地板颜色
  area: {
    // 贴图
    texture: {
      source: AREA_TEXTURE,
      repeat: [0.001, 0.001], // 设置重复次数，确保贴图只出现一次
      offset: [0.5, 0.5]
    },
    // block
    mesh: {
      height: 0.1,
      side: { color: '#1354B0', opacity: 0.8 },
      line: { color: '#fff', opacity: 1 },
      text: { scale: [1, 1, 1] } // 文字缩放比例
    }
  },
  point: {
    scale: [1, 1, 1]
  }
};

const AREA_GROUP_TYPE = 'areaBlock'; // 用来判断点击的

/**
 * 将经纬度转化成3d信息
 * @param {*} lnglat
 * @param {*} mapCenter
 * @returns
 */
const lnglatToVector3 = (lnglat, mapCenter) => {
  try {
    const projection = d3.geoMercator().center(mapCenter).scale(1000).translate([0, 0]);
    const [x, y] = projection([lnglat[0], lnglat[1]]);
    return [y, x, 0];
  } catch (error) {
    console.warn(error);
    return [0, 0, 0];
  }
};
// 动画
const transiform = (prevPosition, nextPosition, time) => {
  try {
    new TWEEN.Tween(prevPosition).to(nextPosition, time).start();
  } catch (error) {
    console.warn(error);
  }
};
// 清除mesh缓存
const clearMeshCache = object => {
  try {
    if (object.type === 'Mesh') {
      object.geometry.dispose();
      object.material.dispose();
    }
  } catch (error) {
    console.warn(error);
  }
};
// 清除group
const clearGroup = group => {
  try {
    // 递归释放物体下的 几何体 和 材质
    const removeObj = object => {
      const objectChildren = object.children.filter(x => x);
      objectChildren.forEach(item => {
        if (item.type === 'Mesh') {
          clearMeshCache(item);
        }
        if (item.children?.length) {
          removeObj(item);
        }
        item.clear();
      });
      object.clear();
    };

    removeObj(group);
  } catch (error) {
    console.warn(error);
  }
};

const NAME_AREA_LIST = 'NAME_AREA_LIST'; // 区域的group名称
const NAME_POINT_LIST = 'NAME_POINT_LIST'; // 点的group名称

class TownMap {
  constructor({ container, geoJson, onClick }) {
    this.container = container;

    this.geoJson = geoJson;
    this.cameraPosition = { x: 100, y: 0, z: 100 }; // 相机位置
    this.scene = null; // 场景
    this.camera = null; // 相机
    this.renderer = null; // 渲染器
    this.css2DRender = null; // 2D渲染器
    this.css3DRender = null; // 3D渲染器
    this.controls = null; // 控制器

    this.ground = null;

    this.mouseMoveAreaList = []; // 接受鼠标事件对象(hover)
    this.mouseMoveAreaObject = null; // 当前选中对象(hover)

    this.mapCenter = []; // 地图中心点。通过geojson计算
    this.threeFeatures = []; // 核心地图渲染数据

    this.pointIcon = '';
    this.pointList = []; // 撒点数据

    this.onClick = onClick;
  }

  /**
   * @desc 初始化
   * */

  init = async () => {
    const { container } = this;
    try {
      this.initScene();
      // this.initAxes();
      this.initCamera();
      // this.initCameraHelper();
      this.initRenderer();
      this.initControls();
      this.initPointLight();
      this.initGround();

      await this.initMapData();
      await this.drawMap();
      this.initAnimation();

      container.addEventListener('mousemove', this.onMouseMove, false);
      window.addEventListener('resize', this.onWindowResize);
    } catch (error) {
      console.warn(error);
    }
  };
  addPointList = async ({ icon, points }) => {
    try {
      this.pointIcon = icon;
      this.pointList = points;
      await this.drawPoints();
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建--场景
  initScene = () => {
    try {
      const scene = new THREE.Scene();
      this.scene = scene;
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建相机
  initCamera = () => {
    const { container, cameraPosition } = this;
    try {
      const { clientWidth, clientHeight } = container;
      const camera = new THREE.PerspectiveCamera(10, clientWidth / clientHeight, 1, 100000000);
      camera.up.set(0, 0, 1);
      camera.lookAt(0, 0, 0);
      camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z);
      this.camera = camera;
      this.scene.add(camera);
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建--相机辅助线
  initCameraHelper = () => {
    try {
      const helper = new THREE.CameraHelper(this.camera);
      this.scene.add(helper);
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建--一个xyz坐标轴
  initAxes = () => {
    try {
      const axes = new THREE.AxesHelper(100);
      this.scene.add(axes);
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建渲染器
  initRenderer = () => {
    const { container } = this;
    try {
      const { clientWidth, clientHeight } = container;
      const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(clientWidth, clientHeight);
      renderer.setPixelRatio(window.devicePixelRatio * 1);

      const css2DRender = new CSS2DRenderer();
      css2DRender.setSize(clientWidth, clientHeight);
      css2DRender.domElement.style.position = 'absolute';
      css2DRender.domElement.style.top = 0;
      css2DRender.domElement.style.zIndex = 1;
      css2DRender.domElement.style.pointerEvents = 'none';

      const css3DRender = new CSS3DRenderer();
      css3DRender.setSize(clientWidth, clientHeight);
      css3DRender.domElement.style.position = 'absolute';
      css3DRender.domElement.style.top = 0;
      css3DRender.domElement.style.zIndex = 2;
      css3DRender.domElement.style.pointerEvents = 'none';

      container.appendChild(renderer.domElement);
      container.appendChild(css2DRender.domElement);
      container.appendChild(css3DRender.domElement);
      this.renderer = renderer;
      this.css2DRender = css2DRender;
      this.css3DRender = css3DRender;
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建--控制器
  initControls = () => {
    try {
      const controls = new OrbitControls(this.camera, this.renderer.domElement);
      this.controls = controls;
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建--灯光
  initPointLight = () => {
    try {
      const pointLight = new THREE.PointLight(0xffffff, 1, 0);
      pointLight.position.set(0, 0, 5);
      this.scene.add(pointLight);
    } catch (error) {
      console.warn(error);
    }
  };
  // 创建地面
  initGround = () => {
    try {
      const source = get(defaultThemes, ['ground', 'texture', 'source']);
      const opacity = get(defaultThemes, ['ground', 'texture', 'opacity']);
      const groundSize = get(defaultThemes, ['ground', 'texture', 'size']);
      const texture = new THREE.TextureLoader().load(source);
      texture.colorSpace = THREE.SRGBColorSpace;
      const material = new THREE.MeshBasicMaterial({ opacity, map: texture, transparent: true });
      const geometry = new PlaneGeometry(...groundSize);
      const ground = new THREE.Mesh(geometry, material);
      ground.position.set(0, 0, 0);
      ground.receiveShadow = true;
      ground.castShadow = true;

      this.ground = ground;
      this.scene.add(ground);
    } catch (error) {
      console.warn(error);
    }
  };

  // 初始化地图数据
  initMapData = async () => {
    const { geoJson } = this;
    try {
      const features = get(geoJson, ['features']) || [];

      if (features?.length) {
        const mapCenter = get(turf.center(geoJson), ['geometry', 'coordinates']) || [];

        const threeFeatures = features.map(element => {
          const center = get(turf.center(element), ['geometry', 'coordinates']) || mapCenter;
          const areaItems = get(element, ['geometry', 'coordinates']) || []; // 划线用的坐标点
          // todo，此处根据实际情况，递归减少层级
          const mercator = flattenDepth(areaItems, 1).map(elem => {
            const threeLnglat = lnglatToVector3(elem, mapCenter);
            const vector3 = new THREE.Vector3(...threeLnglat);
            return vector3;
          });
          return {
            properties: cloneDeep(get(element, ['properties'])),
            threeCenter: lnglatToVector3(center, mapCenter), // 三维中心
            threeMercator: [mercator]
          };
        });

        this.mapCenter = mapCenter;

        this.threeFeatures = threeFeatures;
      }
    } catch (error) {
      console.warn(error);
    }
  };
  createAreaGroupMesh = ({ properties, threeCenter, threeMercator }) => {
    try {
      const areaGroup = new THREE.Group();
      const [areaItem] = threeMercator;
      const areaName = get(properties, ['name']);
      areaGroup._groupType = AREA_GROUP_TYPE;
      areaGroup._groupName = areaName;
      const textureSource = get(defaultThemes, ['area', 'texture', 'source']); // 贴图原位置
      const textureRepeat = get(defaultThemes, ['area', 'texture', 'repeat']); // 贴图尺寸
      const textureOffset = get(defaultThemes, ['area', 'texture', 'offset']); // 贴图偏移

      const meshHeight = get(defaultThemes, ['area', 'mesh', 'height']); // 模型高度

      const meshSideColor = get(defaultThemes, ['area', 'mesh', 'side', 'color']); // 模型边的颜色
      const meshSideOpacity = get(defaultThemes, ['area', 'mesh', 'side', 'opacity']); // 模型边的透明度

      const meshLineColor = get(defaultThemes, ['area', 'mesh', 'line', 'color']); // 模型边线的颜色
      const meshLineOpacity = get(defaultThemes, ['area', 'mesh', 'line', 'opacity']); // 模型边线的透明度

      const meshTextScale = get(defaultThemes, ['area', 'mesh', 'text', 'scale']);

      const extrudeSettings = { depth: meshHeight, steps: 1, bevelSegments: 0, curveSegments: 1, bevelEnabled: false };
      const texture = new THREE.TextureLoader().load(textureSource);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.repeat.set(...textureRepeat); // 设置重复次数，确保贴图只出现一次
      texture.offset.set(...textureOffset); // 设置贴图偏移
      texture.magFilter = THREE.NearestFilter; // 设置纹理放大过滤器
      texture.minFilter = THREE.LinearMipMapLinearFilter; // 设置纹理缩小过滤器

      const blockMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0, map: texture });
      const blockSideMaterial = new THREE.MeshBasicMaterial({
        color: meshSideColor,
        opacity: meshSideOpacity,
        transparent: true
      });
      const lineMaterial = new THREE.LineBasicMaterial({
        color: meshLineColor,
        opacity: meshLineOpacity,
        transparent: true
      });
      // 画带高度的模块
      const shape = new THREE.Shape(areaItem);
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      const blockMesh = new THREE.Mesh(geometry, [blockMaterial, blockSideMaterial]);
      // 划线(上下两根)
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(areaItem); //
      const lineMesh = new THREE.Line(lineGeometry, lineMaterial);
      const lineMeshCp = lineMesh.clone();
      lineMeshCp.position.z = meshHeight;

      // 文字
      const spriteDiv = document.createElement('div');
      spriteDiv.className = 'area-name';
      spriteDiv.textContent = areaName;
      spriteDiv.style.pointerEvents = 'none';
      const textSprite = new CSS3DSprite(spriteDiv);
      textSprite.visible = true;
      textSprite.position.set(threeCenter[0], threeCenter[1], meshHeight + 0.2);
      textSprite.scale.set(...meshTextScale);

      areaGroup.add(blockMesh);
      areaGroup.add(lineMesh);
      areaGroup.add(lineMeshCp);
      // areaGroup.add(circleMesh);
      areaGroup.add(textSprite);

      this.mouseMoveAreaList.push(blockMesh);
      return { areaGroup };
    } catch (error) {
      console.warn(error);
    }
  };
  // 绘制图形
  drawMap = () => {
    const { threeFeatures } = this;
    try {
      const areaListGroup = new THREE.Group();
      areaListGroup.name = NAME_AREA_LIST;
      threeFeatures.forEach(areaData => {
        const { areaGroup } = this.createAreaGroupMesh(areaData);
        areaListGroup.add(areaGroup);
      });
      this.scene.add(areaListGroup);
    } catch (error) {
      console.warn(error);
    }
  };
  // todo
  // 点击事件也可以通过创建一个mesh的方式完成
  createPointGroupMesh = feature => {
    const { pointIcon, mapCenter } = this;
    try {
      const pointScale = get(defaultThemes, ['point', 'scale']);
      const coordinates = get(feature, ['geometry', 'coordinates']);
      const threeLnglat = lnglatToVector3(coordinates, mapCenter);

      const pointGroup = new THREE.Group();
      // 创建Sprite
      const spriteImage = document.createElement('img');
      spriteImage.src = pointIcon.url;
      spriteImage.className = 'point-image';

      const pointName = get(feature, ['properties', 'name']);
      const spriteName = document.createElement('section');
      spriteName.className = 'point-name';
      spriteName.textContent = pointName;

      const spriteDivContainer = document.createElement('section');
      spriteDivContainer.className = 'point-container';
      spriteDivContainer.appendChild(spriteImage);
      spriteDivContainer.appendChild(spriteName);
      spriteDivContainer.addEventListener('click', () => {
        this.onClick(feature.properties);
      });

      const spriteDivLayout = document.createElement('section');
      spriteDivLayout.className = 'point-layout';
      spriteDivLayout.appendChild(spriteDivContainer);

      const textSprite = new CSS3DSprite(spriteDivLayout);
      textSprite.visible = true;
      textSprite.scale.set(...pointScale);
      textSprite.position.set(threeLnglat[0], threeLnglat[1], 0.4);

      // console.error(textSprite);
      // textSprite.visible = false;

      // 添加盒子可做点击
      // const boxGeometry = new THREE.BoxGeometry(30, 30, 30);
      // const boxMaterial = new THREE.MeshStandardMaterial({ color: 'blue' });
      // const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
      // boxMesh.position.set(threeLnglat[0], threeLnglat[1], 0.4);
      // boxMesh.scale.set(...pointScale);
      // boxMesh.visible = false;

      pointGroup.add(textSprite);
      // pointGroup.add(boxMesh);

      return { pointGroup };
    } catch (error) {
      console.warn(error);
    }
  };
  // 点击point
  drawPoints = () => {
    const { pointList } = this;
    try {
      // 移除所有的旧的group
      const prevPointListGroupGroup = this.scene.getObjectByName(NAME_POINT_LIST);
      if (prevPointListGroupGroup) {
        clearGroup(prevPointListGroupGroup);
        this.scene.remove(prevPointListGroupGroup);
      }

      const pointListGroup = new THREE.Group();
      pointListGroup.name = NAME_POINT_LIST;
      pointList.forEach(point => {
        const { pointGroup } = this.createPointGroupMesh(point);
        pointListGroup.add(pointGroup);
      });
      this.scene.add(pointListGroup);
    } catch (error) {
      console.warn(error);
    }
  };
  onWindowResize = () => {
    const { container } = this;
    try {
      const { clientWidth, clientHeight } = container;
      this.camera.aspect = clientWidth / clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(clientWidth, clientHeight);
      this.css2DRender.setSize(clientWidth, clientHeight);
      this.css3DRender.setSize(clientWidth, clientHeight);
    } catch (error) {
      console.warn(error);
    }
  };
  onMouseMove = event => {
    const { container, camera, mouseMoveAreaList } = this;
    try {
      const { clientWidth, clientHeight } = container;
      const x = (event.clientX / clientWidth) * 2 - 1; // 标准设备横坐标
      const y = -(event.clientY / clientHeight) * 2 + 1; // 标准设备纵坐标
      const standardVector = new THREE.Vector3(x, y, 0.5); // 标准设备坐标
      // 标准设备坐标转世界坐标
      const worldVector = standardVector.unproject(this.camera);
      // 射线投射方向单位向量(worldVector坐标减相机位置坐标)
      const ray = worldVector.sub(camera.position).normalize();
      // 创建-射线投射器对象
      const raycaster = new THREE.Raycaster(camera.position, ray);
      // 返回射线选中的对象
      const intersects = raycaster.intersectObjects(mouseMoveAreaList);

      const moveHeight = get(defaultThemes, ['area', 'mesh', 'height']);
      if (intersects.length) {
        const firstIntersect = intersects[0]; // 射线方向第一个对象
        if (get(firstIntersect, ['object', 'parent', '_groupType']) === AREA_GROUP_TYPE) {
          const nextSelectObjectParent = firstIntersect.object.parent;
          const prevSelectObjectParent = this.mouseMoveAreaObject;
          if (prevSelectObjectParent) {
            transiform(
              prevSelectObjectParent.position,
              { x: prevSelectObjectParent.position.x, y: prevSelectObjectParent.position.y, z: 0 },
              100
            );
          }
          transiform(
            nextSelectObjectParent.position,
            { x: nextSelectObjectParent.position.x, y: nextSelectObjectParent.position.y, z: moveHeight },
            100
          );
          this.mouseMoveAreaObject = nextSelectObjectParent;
        }
      }
    } catch (error) {
      console.warn(error);
    }
  };

  initAnimation = () => {
    try {
      TWEEN.update();
      this.controls && this.controls.update();
      this.renderer && this.renderer.render(this.scene, this.camera);
      this.css2DRender && this.css2DRender.render(this.scene, this.camera);
      this.css3DRender && this.css3DRender.render(this.scene, this.camera);

      // this.ground.rotation.z += 0.001;
      requestAnimationFrame(this.initAnimation);
    } catch (error) {
      console.warn(error);
    }
  };
}

export default TownMap;

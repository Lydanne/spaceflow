# mongoose 数据库模型 JS 规范 `[Js.Model]`

> - includes `*/models/*.js`
> - override `[JsTs.Base]`

## 模型文件命名规范 `[Js.Model.FileName]`

> - override `[JsTs.FileName]`

- 文件名使用小写加下划线命名（如 `user_extends.js`）,或者使用小写加横线命名（如 `user-extends.js`）
- 文件名应与模型名称对应

### Good

```txt
user.js
user_extends.js
user-profile.js
```

### Bad

```txt
User.js
userExtends.js
UserProfile.js
```

## Schema 字段命名规范 `[Js.Model.FieldName]`

- 字段名使用小写加下划线命名（snake_case）
- 避免使用驼峰命名
- 要补充字段注释
- 要补充字段类型

### Good

```javascript
const userSchema = new Schema({
  user_name: { type: String },
  created_at: { type: Date },
  is_active: { type: Boolean },
});
```

### Bad

```javascript
const userSchema = new Schema({
  userName: { type: String },
  createdAt: { type: Date },
  isActive: { type: Boolean },
});
```

## Schema 定义规范 `[Js.Model.SchemaDefinition]`

- 必须为每个字段指定类型
- 必要时添加 `required`、`default` 等属性
- 复杂类型应使用嵌套 Schema 或引用

### Good

```javascript
const userSchema = new Schema({
  user_name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  age: { type: Number, default: 0 },
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  created_at: { type: Date, default: Date.now },
});
```

### Bad

```javascript
const userSchema = new Schema({
  user_name: String,
  email: String,
  age: Number,
  status: String,
  created_at: Date,
});
```

## 索引定义规范 `[Js.Model.IndexDefinition]`

- 需要添加注释说明索引用途
- 不能在 Schema 定义中直接添加索引，添加到索引要注释掉

### Good

```javascript
const orderSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "User" },
  order_no: { type: String },
  created_at: { type: Date },
});

// 用户订单查询索引
// orderSchema.index({ user_id: 1, created_at: -1 });
// 订单号唯一索引
// orderSchema.index({ order_no: 1 }, { unique: true });
```

### Bad

```javascript
const orderSchema = new Schema({
  user_id: { type: Schema.Types.ObjectId, ref: "User", index: true },
  order_no: { type: String, index: true },
  created_at: { type: Date, index: true },
});
```

## 虚拟字段规范 `[Js.Model.VirtualField]`

- 虚拟字段命名使用小写加下划线
- 虚拟字段应在 Schema 定义后声明
- 需要添加注释说明虚拟字段用途

### Good

```javascript
const userSchema = new Schema({
  first_name: { type: String },
  last_name: { type: String },
});

// 完整姓名虚拟字段
userSchema.virtual("full_name").get(function () {
  return this.first_name + " " + this.last_name;
});
```

### Bad

```javascript
const userSchema = new Schema({
  first_name: { type: String },
  last_name: { type: String },
  full_name: { type: String }, // 不应该存储可计算的字段
});
```

## 中间件/钩子规范 `[Js.Model.Middleware]`

- 中间件应在 Schema 定义后、模型导出前声明
- 需要添加注释说明中间件用途
- 避免在中间件中执行耗时操作

### Good

```javascript
const userSchema = new Schema({
  password: { type: String },
  updated_at: { type: Date },
});

// 保存前更新时间戳
userSchema.pre("save", function (next) {
  this.updated_at = new Date();
  next();
});

// 保存前加密密码
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});
```

### Bad

```javascript
const userSchema = new Schema({
  password: { type: String },
});

userSchema.pre("save", function (next) {
  // 没有注释说明用途
  this.password = bcrypt.hashSync(this.password, 10); // 使用同步方法阻塞
  next();
});
```

## 静态方法规范 `[Js.Model.StaticMethod]`

- 静态方法命名使用小驼峰
- 静态方法应在 Schema 定义后声明
- 需要添加注释说明方法用途

### Good

```javascript
const userSchema = new Schema({
  email: { type: String },
  status: { type: String },
});

// 根据邮箱查找用户
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email });
};

// 查找所有活跃用户
userSchema.statics.findActiveUsers = function () {
  return this.find({ status: "active" });
};
```

### Bad

```javascript
const userSchema = new Schema({
  email: { type: String },
});

userSchema.statics.find_by_email = function (email) {
  // 方法名不应使用下划线
  return this.findOne({ email: email });
};
```

## 实例方法规范 `[Js.Model.InstanceMethod]`

- 实例方法命名使用小驼峰
- 实例方法应在 Schema 定义后声明
- 需要添加注释说明方法用途
- 实例方法内部使用 `this` 访问文档属性

### Good

```javascript
const userSchema = new Schema({
  password: { type: String },
  login_count: { type: Number, default: 0 },
});

// 验证密码
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// 增加登录次数
userSchema.methods.incrementLoginCount = function () {
  this.login_count += 1;
  return this.save();
};
```

### Bad

```javascript
const userSchema = new Schema({
  password: { type: String },
});

userSchema.methods.compare_password = function (candidatePassword) {
  // 方法名不应使用下划线
  return bcrypt.compareSync(candidatePassword, this.password);
};
```

## 关联引用规范 `[Js.Model.Reference]`

- 引用字段使用 `_id` 后缀命名
- 必须指定 `ref` 属性
- 需要添加注释说明关联关系

### Good

```javascript
const orderSchema = new Schema({
  // 关联用户
  user_id: { type: Schema.Types.ObjectId, ref: "User", required: true },
  // 关联商品列表
  product_ids: [{ type: Schema.Types.ObjectId, ref: "Product" }],
});
```

### Bad

```javascript
const orderSchema = new Schema({
  user: { type: Schema.Types.ObjectId }, // 缺少 ref，命名不规范
  products: [{ type: String }], // 应使用 ObjectId 引用
});
```

## 必须写明字段的类型 `[Js.Model.FieldType]`

- 字段定义必须使用对象形式，明确指定 `type` 属性
- 禁止使用简写形式（如 `field: String`）
- 不允许使用 Object 等模糊类型

### Good

```javascript
const userSchema = new Schema({
  // 用户名
  user_name: { type: String, required: true },
  // 年龄
  age: { type: Number, default: 0 },
  // 是否激活
  is_active: { type: Boolean, default: true },
  // 创建时间
  created_at: { type: Date, default: Date.now },
});
```

### Bad

```javascript
const userSchema = new Schema({
  user_name: String, // 缺少类型对象包装
  age: Number,
  is_active: Boolean,
  created_at: Date,
  ext: { type: Object, default: {} },
  ext2: {},
});
```

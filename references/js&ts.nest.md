# Nestjs 项目下的规范 `[JsTs.Nest]`

> - includes `*.controller.ts` `*.service.ts` `*.module.ts` `*.dto.ts` `*.pipe.ts` `*.guard.ts` `*.interceptor.ts` `*.filter.ts` `*.exception-filter.ts` `*.proxy.ts` `*.model.ts`
> - override `[JsTs.FileName]`

## 目录框架规范 `[JsTs.Nest.DirStructure]`

- 使用下面的 Good 目录结构
- 文件名使用小写加横线命名（如 `user-extends.module.ts`）
- 每个模块的目录下必须包含 `module.ts` 文件
- 每个模块的目录下必须包含 `controller.ts` 文件
- 每个模块的目录下必须包含 `service.ts` 文件
- 每个模块的目录下可以包含 `dto` 目录，用于存放数据传输对象
- 每个模块的目录下可以包含 `pipe` 目录，用于存放管道
- 每个模块的目录下可以包含 `guard` 目录，用于存放守卫
- 每个模块的目录下可以包含 `interceptor` 目录，用于存放拦截器
- 每个模块的目录下可以包含 `filter` 目录，用于存放异常过滤器

### Good

```txt
src/
├── user/         # 用户模块
│   ├── user.module.ts
│   ├── user.controller.ts
│   ├── user.service.ts
│   ├── user.proxy.ts
│   ├── user.model.ts
│   └── dto/      # 数据传输对象
├── auth/         # 认证模块
│   ├── auth.module.ts
│   ├── auth.controller.ts
│   ├── auth.service.ts
│   ├── auth.proxy.ts
│   ├── auth.model.ts
├── common/           # 公共模块
│   ├── filters/      # 异常过滤器
│   ├── guards/       # 守卫
│   ├── interceptors/ # 拦截器
│   └── pipes/        # 管道
├── config/           # 配置文件
├── app.module.ts     # 根模块
└── main.ts          # 应用入口
```

### Bad

```txt
src/
├── user.controller.ts
├── user.service.ts
├── auth.controller.ts
├── auth.service.ts
├── filter.ts
├── guard.ts
└── main.ts
```

## 控制器命名规范 `[JsTs.Nest.ControllerDefinition]`

- 该文件不能写业务逻辑，只能写调用 service 的代码
- 文件名使用小写加横线命名（如 `user-extends.controller.ts`）
- 文件名必须加 `.controller.ts` 后缀
- 注解和装饰器上的静态值无需进行魔法值的提炼 `[JsTs.Base.NoMagicStringsAndNumbers]`

### Good

```txt
user-extends.controller.ts
```

### Bad

```txt
userController.ts
```

## 服务命名规范 `[JsTs.Nest.ServiceDefinition]`

- 这个是目前业务代码核心编写的地方
- 规定不能直接调用数据库查询，只能通过 model 来调用
- 规定不能直接调用旧的业务代码，只能通过 proxy 来调用
- 文件名使用小写加横线命名（如 `user-extends.service.ts`）
- 文件名必须加 `.service.ts` 后缀

### Good

```txt
user-extends.service.ts
```

### Bad

```txt
userService.ts
```

## 模块命名规范 `[JsTs.Nest.ModuleDefinition]`

- 文件名使用小写加横线命名（如 `user-extends.module.ts`）
- 文件名必须加 `.module.ts` 后缀

### Good

```txt
user-extends.module.ts
```

### Bad

```txt
userModule.ts
```

## Dto 命名规范 `[JsTs.Nest.DtoDefinition]`

> - override `[JsTs.Base.NoMagicStringsAndNumbers]`

- 文件名使用小写加横线命名（如 `user-extends.dto.ts`）
- 文件名必须加 `.dto.ts` 后缀
- dto 目录下必须包含 `dto.ts` 文件
- dto 里的类的属性可以使用小驼峰或者下划线命名

### Good

```txt
user-extends.dto.ts
```

### Bad

```txt
userDto.ts
```

## Proxy 编写规范 `[JsTs.Nest.ProxyDefinition]`

- 这是专门为了和旧的业务通讯而存在的和旧代码通讯使用的方式就是 SyncService
- 文件名使用小写加横线命名（如 `user.proxy.ts`）
- 文件名必须加 `.proxy.ts` 后缀
- 内部只能写使用 syncService 调用的逻辑
- SyncService 只能在 proxy.ts 中使用

### Good

```typescript
// user.proxy.ts
import { Injectable } from "@nestjs/common";
import { User } from "@app/entity/models";
import { SyncService } from "@app/sync";

@Injectable()
export class UserProxy {
  constructor(private readonly syncService: SyncService) {}

  getUsersByNames(names: string[], callback: (user: User) => void) {
    return this.syncService.call("userProxy").getUsersByNames(names, callback);
  }
}
```

### Bad

```typescript
// user.proxy.ts
import { Injectable } from "@nestjs/common";
import { User } from "@app/entity/models";
import { InjectModel } from "@app/entity/decorator";
import { Model } from "mongoose";

@Injectable()
export class UserProxy {
  constructor(@InjectModel(User) private readonly userModel: Model<User>) {}

  getUsersByNames(names: string[], callback: (user: User) => void) {
    return this.userModel.find({ name: { $in: names } }, callback);
    // 不能写数据库查询，只能写和旧的业务通讯代码，数据库查询的逻辑要放在 user.model.ts
  }
}
```

## Model 编写规范 `[JsTs.Nest.ModelDefinition]`

> - includes `*.model.ts`

- 内部只能写使用 model 数据库调用的逻辑
- 文件名使用小写加横线命名（如 `user.model.ts`）
- 文件名必须加 `.model.ts` 后缀

### Good

```typescript
// user.model.ts
import { Injectable } from "@nestjs/common";
import { User } from "@app/entity/models";
import { InjectModel } from "@app/entity/decorator";
import { Model } from "mongoose";

@Injectable()
export class UserProxy {
  constructor(@InjectModel(User) private readonly userModel: Model<User>) {}

  getUsersByNames(names: string[], callback: (user: User) => void) {
    return this.userModel.find({ name: { $in: names } }, callback);
  }
}
```

### Bad

```typescript
// user.model.ts
import { Injectable } from "@nestjs/common";
import { User } from "@app/entity/models";
import { SyncService } from "@app/sync";

@Injectable()
export class UserProxy {
  constructor(private readonly syncService: SyncService) {}

  getUsersByNames(names: string[], callback: (user: User) => void) {
    return this.syncService.call("userProxy").getUsersByNames(names, callback);
    // 不能写和旧的业务通讯代码，只能写数据库查询的逻辑，和旧的业务通讯的代码要放在 proxy.ts 中
  }
}
```

## 业务代码编写规范 `[JsTs.Nest.BusinessDefinition]`

- 目前所有的新代码都应该写在 nest 里

### Good

```typescript
// nest-src/apps/app/src/user/user.controller.ts
```

```typescript
// nest-src/apps/app/src/user/user.service.ts
```

```typescript
// nest-src/apps/app/src/user/user.module.ts
```

### Bad

```typescript
// proxy/user.js
```

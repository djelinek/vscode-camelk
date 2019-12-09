from("timer:tick")
    .process { e -> e.getIn().body = "Hello uitests!" }
    .to("log:info");
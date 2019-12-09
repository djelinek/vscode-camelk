import org.apache.camel.builder.RouteBuilder;

public class JavaExample extends RouteBuilder {
  
    @Override
    public void configure() throws Exception {
        from("timer:tick")
            .setBody()
              .constant("Hello uitests!")
            .to("log:info");
    }
}